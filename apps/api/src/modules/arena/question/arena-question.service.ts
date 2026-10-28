import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { InjectPgConnection,withPgTransaction,type PgConnection } from '../../../postgres/connection.js';
import { SqlRecords } from '../../../postgres/records.js';
import { literal,rows,sql } from '../../../postgres/sql.js';
import { sampleContentWords } from '../../vocabulary/content-reader.js';
import { ArenaMatchStatus } from '../rows/arena-match.row.js';


type SampledWord = {
  _id:string;
  word: string;
  meaning: string;
  image?: string;
  definition?: string;
  example?: { en?: string; vi?: string };
  partOfSpeech?: string;
};

@Injectable()
export class ArenaQuestionService {
  constructor(@InjectPgConnection() private readonly db:PgConnection){}
  private get matches(){return new SqlRecords(this.db,'arenamatches');}
  private get questions(){return new SqlRecords(this.db,'arenamatchquestions');}
  /** Sinh và lưu snapshot câu hỏi vocabulary cho một trận ranked. */
  async createRankedQuestions(matchId: string, count: number) {
    const matchPgId = this.uuid(matchId, 'matchId');
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new WsException(
        'Question count must be an integer between 1 and 100',
      );
    }
    const match = await this.matches.one(sql`id=${matchPgId}::uuid`);
    if (!match) throw new WsException('Match not found');
    if (match.questionMode !== 'MEANING_TO_WORD') {
      throw new WsException('Ranked questions only support MEANING_TO_WORD');
    }
    if (
      ![ArenaMatchStatus.COUNTDOWN, ArenaMatchStatus.PLAYING].includes(
        match.status,
      )
    ) {
      throw new WsException('Match cannot receive questions');
    }

    const existing=await this.questions.select(sql`match_id=${matchPgId}::uuid`,literal('ORDER BY "order"'));
    // Nếu câu hỏi đã tồn tại, dùng lại snapshot để reload không đổi đề.
    if (existing.length) {
      if (existing.length !== count)
        throw new WsException('Match already has a different question count');
      return existing.map((question) => this.questionPayload(question));
    }

    const words=await sampleContentWords(this.db,{count,requireMeaning:true});
    // Không đủ từ hợp lệ thì dừng tạo trận thay vì tạo bộ câu hỏi thiếu.
    if (words.length < count) {
      throw new WsException(
        `Not enough active vocabulary: need ${count}, found ${words.length}`,
      );
    }

    const snapshots = words.map((word, index) => ({
      matchId: matchPgId,
      vocabularyId: word._id,
      order: index + 1,
      type: 'MEANING_TO_WORD' as const,
      question: word.meaning.trim(),
      correctAnswer: word.word.trim(),
      imageUrl: word.image,
      explanation: word.definition,
      example: word.example?.en,
      translation: word.example?.vi,
      wordType: word.partOfSpeech,
      options: [],
      startedAt: index === 0 ? new Date() : undefined }));
    return withPgTransaction(this.db,async db=>{
      await rows(db,sql`SELECT id FROM public.arenamatches WHERE id=${matchPgId}::uuid FOR UPDATE`);
      const questions=new SqlRecords(db,'arenamatchquestions');
      const existing=await questions.select(sql`match_id=${matchPgId}::uuid`,literal('ORDER BY "order"'));
      if(existing.length){if(existing.length!==count)throw new WsException('Match already has a different question count');return existing.map(question=>this.questionPayload(question));}
      for(const snapshot of snapshots)await questions.insert(snapshot,['match_id','order']);
      return (await questions.select(sql`match_id=${matchPgId}::uuid`,literal('ORDER BY "order"'))).map(question=>this.questionPayload(question));
    });
  }

  /** Lấy một câu hỏi thuộc đúng trận đấu. */
  async getQuestionById(matchId: string, questionId: string) {
    const question=await this.questions.one(sql`id=${this.uuid(questionId,'questionId')}::uuid AND match_id=${this.uuid(matchId,'matchId')}::uuid`);
    if (!question) throw new WsException('Question not found in this match');
    return question;
  }

  /** Gán thời điểm bắt đầu cho câu hỏi nếu trận đang PLAYING. */
  async startQuestion(matchId: string, questionId: string) {
    const question = await this.getQuestionById(matchId, questionId);
    const match = await this.matches.one(sql`id=${question.matchId}::uuid`);
    if (!match || match.status !== ArenaMatchStatus.PLAYING) {
      throw new WsException('Match is not playing');
    }
    await this.questions.patch(sql`id=${question._id}::uuid AND started_at IS NULL`,{startedAt:new Date()});
    return this.questionPayload(
      await this.getQuestionById(matchId, questionId),
    );
  }

  /** Kiểm tra chuỗi ID trước khi dùng trong truy vấn PostgreSQL. */
  private uuid(value: string, field: string) {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
      throw new WsException(`Invalid ${field}`);
    return value;
  }

  /** Chuyển document câu hỏi thành payload tối thiểu gửi cho client. */
  private questionPayload(question:any) {
    return {
      questionId: String(question._id),
      order: question.order,
      meaning: question.question,
      answerLength: question.correctAnswer.length,
      image: question.imageUrl };
  }
}
