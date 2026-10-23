import { PgId } from '../../../postgres/compat.js';
import { Injectable } from '@nestjs/common';
import { InjectPgModel } from '../../../postgres/compat.js';
import { WsException } from '@nestjs/websockets';
import { type Model } from '../../../postgres/compat.js';
import { Word } from '../../vocabulary/words/word.schema.js';
import { ArenaMatch, ArenaMatchStatus } from '../schemas/arena-match.schema.js';

import {
  ArenaMatchQuestion,
  ArenaMatchQuestionDocument } from '../schemas/arena-match-question.schema.js';

type SampledWord = {
  _id: PgId;
  word: string;
  meaning: string;
  image?: string;
  definition?: string;
  example?: { en?: string; vi?: string };
  partOfSpeech?: string;
};

@Injectable()
export class ArenaQuestionService {
  constructor(
    @InjectPgModel(ArenaMatch.name)
    private readonly arenaMatchModel: Model<ArenaMatch>,
    @InjectPgModel(ArenaMatchQuestion.name)
    private readonly arenaMatchQuestionModel: Model<ArenaMatchQuestion>,
    @InjectPgModel(Word.name)
    private readonly wordModel: Model<Word>,
  ) {}

  /** Sinh và lưu snapshot câu hỏi vocabulary cho một trận ranked. */
  async createRankedQuestions(matchId: string, count: number) {
    const matchPgId = this.uuid(matchId, 'matchId');
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new WsException(
        'Question count must be an integer between 1 and 100',
      );
    }
    const match = await this.arenaMatchModel.findById(matchPgId);
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

    const existing = await this.arenaMatchQuestionModel
      .find({ matchId: matchPgId })
      .sort({ order: 1 });
    // Nếu câu hỏi đã tồn tại, dùng lại snapshot để reload không đổi đề.
    if (existing.length) {
      if (existing.length !== count)
        throw new WsException('Match already has a different question count');
      return existing.map((question) => this.questionPayload(question));
    }

    // Select one usable Vietnamese meaning per distinct word, then sample without repetition.
    const words = await this.wordModel.aggregate<SampledWord>([
      {
        $match: {
          isActive: true,
          isDeleted: { $ne: true },
          word: { $regex: /\S/ } } },
      { $unwind: '$parts' },
      { $unwind: '$parts.meanings' },
      {
        $set: {
          arenaMeaning: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ['$parts.meanings.translation', []] },
                  as: 'translation',
                  cond: { $ne: [{ $trim: { input: '$$translation' } }, ''] } } },
              0,
            ] } } },
      { $match: { arenaMeaning: { $type: 'string', $ne: '' } } },
      {
        $group: {
          _id: '$_id',
          word: { $first: '$word' },
          meaning: { $first: '$arenaMeaning' },
          image: { $first: '$image' },
          definition: { $first: '$parts.meanings.definition' },
          example: {
            $first: { $arrayElemAt: ['$parts.meanings.examples', 0] } },
          partOfSpeech: { $first: '$parts.partOfSpeech' } } },
      { $sample: { size: count } },
    ]);
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
    // Repeated calls reuse persisted snapshots; $setOnInsert never overwrites an existing question.
    await this.arenaMatchQuestionModel.bulkWrite(
      snapshots.map((snapshot) => ({
        updateOne: {
          filter: { matchId: matchPgId, order: snapshot.order },
          update: { $setOnInsert: snapshot },
          upsert: true } })),
    );
    const questions = await this.arenaMatchQuestionModel
      .find({ matchId: matchPgId })
      .sort({ order: 1 });
    return questions.map((question) => this.questionPayload(question));
  }

  /** Lấy một câu hỏi thuộc đúng trận đấu. */
  async getQuestionById(matchId: string, questionId: string) {
    const question = await this.arenaMatchQuestionModel.findOne({
      _id: this.uuid(questionId, 'questionId'),
      matchId: this.uuid(matchId, 'matchId') });
    if (!question) throw new WsException('Question not found in this match');
    return question;
  }

  /** Gán thời điểm bắt đầu cho câu hỏi nếu trận đang PLAYING. */
  async startQuestion(matchId: string, questionId: string) {
    const question = await this.getQuestionById(matchId, questionId);
    const match = await this.arenaMatchModel.findById(question.matchId);
    if (!match || match.status !== ArenaMatchStatus.PLAYING) {
      throw new WsException('Match is not playing');
    }
    await this.arenaMatchQuestionModel.updateOne(
      { _id: question._id, startedAt: null },
      { $set: { startedAt: new Date() } },
    );
    return this.questionPayload(
      await this.getQuestionById(matchId, questionId),
    );
  }

  /** Kiểm tra chuỗi ID trước khi dùng trong truy vấn PostgreSQL. */
  private uuid(value: string, field: string) {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
      throw new WsException(`Invalid ${field}`);
    return new PgId(value);
  }

  /** Chuyển document câu hỏi thành payload tối thiểu gửi cho client. */
  private questionPayload(question: ArenaMatchQuestionDocument) {
    return {
      questionId: String(question._id),
      order: question.order,
      meaning: question.question,
      answerLength: question.correctAnswer.length,
      image: question.imageUrl };
  }
}
