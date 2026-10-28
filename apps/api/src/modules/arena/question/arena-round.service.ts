import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { SqlRecords } from '../../../postgres/records.js';
import { literal,rows,sql } from '../../../postgres/sql.js';

import { Injectable,Logger,Optional } from '@nestjs/common';
import { ARENA_DEFAULTS } from '../admin/arena-settings.defaults.js';
import { ArenaMatchTransactions } from '../matches/arena-match-transactions.js';

import { WsException } from '@nestjs/websockets';

import { ArenaMatchService } from '../matches/arena-match.service.js';
import {
ArenaMatchQuestionRow
} from '../rows/arena-match-question.row.js';
import {
ArenaFriendMode,
ArenaMatch,
ArenaMatchStatus,
ArenaMatchType
} from '../rows/arena-match.row.js';
import { ArenaScoringService } from '../scoring/arena-scoring.service.js';
import {
arenaHintLetters,
maskArenaAnswer,
normalizeArenaAnswer
} from './arena-round.utils.js';

export type ArenaRoundEvent = { event: string; data: Record<string, unknown> };

@Injectable()
export class ArenaRoundService {
  private readonly logger = new Logger(ArenaRoundService.name);
  private get matches(){return new SqlRecords(this.nativeDb,'arenamatches');}
private get players(){return new SqlRecords(this.nativeDb,'arenamatchplayers');}
private get questions(){return new SqlRecords(this.nativeDb,'arenamatchquestions');}
private get answers(){return new SqlRecords(this.nativeDb,'arenaplayeranswers');}
constructor(
@InjectPgConnection() private readonly nativeDb:PgConnection,private readonly arenaScoreService: ArenaScoringService,
private readonly matchService: ArenaMatchService,
@Optional() private readonly transactions?: ArenaMatchTransactions
  ) {}

  /** Kiểm tra chuỗi ID hợp lệ trước khi chuyển sang PgId của PostgreSQL. */
  private id(value: string) {
    // Từ chối ID sai định dạng để tránh truy vấn không hợp lệ hoặc gây lỗi PostgreSQL repository.
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
      throw new WsException('Invalid ID');
    return String(value);
  }

  /** Đảm bảo người dùng là thành viên của trận đấu trước khi thực hiện thao tác. */
  async assertMember(matchId: string, userId: string) {
    const member = await this.players.one(sql`("match_id" = ${this.id(matchId)}) AND ("user_id" = ${this.id(userId)})`);

    // Chỉ người chơi thuộc trận mới được nhận dữ liệu hoặc gửi hành động vào trận.
    if (!member) throw new WsException('You are not a player in this match');
  }

  /**
   * Tiếp nhận và chấm một đáp án của người chơi cho câu hỏi hiện tại.
   * Đáp án sai được lưu để thống kê nhưng không kết thúc câu hỏi.
   */
  async submitAnswer(payload: {
    matchId: string;
    questionId: string;
    userId: string;
    answer: string;
  }) {
    const work = async () => {
      const result = await this.submitLocked(payload);
      return { ...result, events: await this.versionEvents(payload.matchId, result.events) };
    };
    if (this.transactions) return this.transactions.run(payload.matchId, work);
    return work();
  }
  private async submitLocked(payload: { matchId: string; questionId: string; userId: string; answer: string }) {
    const { matchId, questionId, userId, answer } = payload;

    // Giới hạn độ dài đáp án để tránh dữ liệu bất thường từ client.
    if (typeof answer !== 'string' || answer.length > 200)
      throw new WsException('Invalid answer');

    const matchPgId = this.id(matchId);
    const userPgId = this.id(userId);
    const [match, player, question] = await Promise.all([
      this.matches.one(sql`id=${matchPgId}::uuid`),
      this.players.one(sql`("match_id" = ${matchPgId}) AND ("user_id" = ${userPgId})`),
      this.questions.one(sql`("id" = ${this.id(questionId)}) AND ("match_id" = ${matchPgId})`),
    ]);
    if (match && this.pauseDue(match, Date.now())) throw new WsException('Match is paused, waiting for reconnect');

    // Người chơi phải còn ở trạng thái PLAYING mới được trả lời.
    if (!player || player.status !== 'PLAYING')
      throw new WsException('You are not an active player');

    // Không cho phép gửi đáp án vào trận đã kết thúc hoặc chưa bắt đầu.
    if (!match || match.status !== ArenaMatchStatus.PLAYING)
      throw new WsException('Match is not playing');
    if (
      match.friendMode === ArenaFriendMode.WORD_CHAIN ||
      match.friendMode === ArenaFriendMode.WORD_GUESS
    )
      throw new WsException('Use the selected game submission event');

    // Chỉ câu hỏi đang được chọn và đã bắt đầu mới nhận đáp án.
    if (
      !question ||
      question.order !== (match.currentQuestionIndex ?? 1) ||
      !question.startedAt
    )
      throw new WsException('Question is not active');
    const now = new Date();
    const expired =
      now.getTime() >=
      question.startedAt.getTime() + match.secondsPerQuestion * 1000;
    const correct =
      !expired &&
      normalizeArenaAnswer(answer) ===
        normalizeArenaAnswer(question.correctAnswer);
    let resolved = question;

    // Đáp án đúng hoặc hết giờ sẽ đóng câu hỏi; điều kiện resolvedAt giúp chống xử lý trùng.
    if (!question.resolvedAt && (correct || expired)) {
      resolved =
        (await this.questions.patch(sql`("id" = ${question._id}) AND ("resolved_at" IS NULL)`,{ resolvedAt: now, winnerId: correct ? userPgId : null })) ??
        (await this.questions.one(sql`id=${question._id}::uuid`)) ??
        question;
    }

    // Khi câu đã đóng, cập nhật điểm và trả đáp án đúng cùng phần giải thích cho client.
    if (resolved.resolvedAt) {
      const events = await this.resolutionEvents(match, resolved);
      const updated = await this.players.one(sql`("match_id" = ${matchPgId}) AND ("user_id" = ${userPgId})`);
      const answerRecord = await this.answers.one(sql`("match_id" = ${matchPgId}) AND ("match_question_id" = ${resolved._id}) AND ("user_id" = ${userPgId})`);
      return {
        events,
        answerResult: {
          matchId,
          questionId,
          resolved: true,
          winnerId: resolved.winnerId ? String(resolved.winnerId) : null,
          timedOut: !resolved.winnerId,
          correctAnswer: resolved.correctAnswer,
          explanation: resolved.explanation,
          example: resolved.example,
          translation: resolved.translation,
          type: resolved.wordType,
          correct: String(resolved.winnerId) === userId,
          points: answerRecord?.earnedScore ?? 0,
          totalScore: updated?.score ?? player.score,
          streak: updated?.currentStreak ?? player.currentStreak } };
    }

    // Đáp án sai chỉ ghi nhận lượt thử; người chơi vẫn có thể trả lời lại câu này.
    const key = {
      matchId: matchPgId,
      matchQuestionId: question._id,
      userId: userPgId };
    try {
      await rows(this.nativeDb,sql`INSERT INTO public.arenaplayeranswers
        (match_id,match_question_id,user_id,selected_answer,is_correct,answered_at,response_time_ms,attempts,timed_out,earned_score,streak_at_answer)
        VALUES(${matchPgId}::uuid,${question._id}::uuid,${userPgId}::uuid,${answer.trim()},false,${now},${Math.max(0,now.getTime()-question.startedAt.getTime())},1,false,0,0)
        ON CONFLICT(match_id,match_question_id,user_id) DO UPDATE SET selected_answer=EXCLUDED.selected_answer,is_correct=false,
          answered_at=EXCLUDED.answered_at,response_time_ms=EXCLUDED.response_time_ms,attempts=COALESCE(arenaplayeranswers.attempts,0)+1,
          payload=arenaplayeranswers.payload-'selectedAnswer'-'isCorrect'-'answeredAt'-'responseTimeMs'-'attempts'
        WHERE arenaplayeranswers.is_correct IS NOT TRUE`);
    } catch (error) {
      // Lỗi duplicate có thể xảy ra khi nhiều request ghi cùng một đáp án đồng thời.
      // Các lỗi khác phải được ném tiếp để không che giấu lỗi hệ thống.
      if (!(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      ))
        throw error;
    }
    return {
      events: [] as ArenaRoundEvent[],
      answerResult: {
        matchId,
        questionId,
        correct: false,
        resolved: false,
        points: 0,
        totalScore: player.score,
        streak: player.currentStreak } };
  }

  /**
   * Cập nhật kết quả của một câu cho tất cả người chơi và tạo các event realtime.
   * scoredQuestionIds bảo đảm một câu chỉ được cộng điểm một lần.
   */
  private async resolutionEvents(
    match: ArenaMatch,
    question: ArenaMatchQuestionRow,
  ): Promise<ArenaRoundEvent[]> {
    const matchId = String(question.matchId);
    const questionId = String(question._id);
    const members = await this.players.select(sql`("match_id" = ${question.matchId})`);
    const responseTimeMs = Math.min(
      match.secondsPerQuestion * 1000,
      Math.max(
        0,
        question.resolvedAt!.getTime() - question.startedAt!.getTime(),
      ),
    );
    let applied = false;

    for (const member of members) {
      const won = String(question.winnerId) === String(member.userId);
      const answerRecord = await this.answers.one(sql`("match_id" = ${question.matchId}) AND ("match_question_id" = ${question._id}) AND ("user_id" = ${member.userId})`);
      const wrongAttempts = Math.max(
        0,
        (answerRecord?.attempts ?? 0) - (won ? 1 : 0),
      );
      const questionScore = won
        ? this.arenaScoreService.calculateQuestionScore({
            timeLimitMs: match.secondsPerQuestion * 1000,
            elapsedMs: responseTimeMs,
            wrongAttempts })
        : 0;
      const hasAnswered = (answerRecord?.attempts ?? 0) > 0;

      // Người thắng tăng điểm và streak; người còn lại bị reset streak về 0.
      const streak=won?sql`COALESCE(current_streak,0)+1`:literal('0');
      const playerUpdate=await this.players.patch(sql`id=${member._id}::uuid AND NOT (COALESCE(scored_question_ids,'[]'::jsonb) ? ${String(question._id)})`,{}, {
        score:sql`COALESCE(score,0)+${questionScore}`,correctAnswers:sql`COALESCE(correct_answers,0)+${won?1:0}`,
        wrongAnswers:sql`COALESCE(wrong_answers,0)+${!won&&hasAnswered?1:0}`,unanswered:sql`COALESCE(unanswered,0)+${!won&&!hasAnswered?1:0}`,
        currentStreak:streak,longestStreak:sql`GREATEST(COALESCE(longest_streak,0),${streak})`,
        totalResponseTimeMs:sql`COALESCE(total_response_time_ms,0)+${hasAnswered?responseTimeMs:0}`,
        scoredQuestionIds:sql`COALESCE(scored_question_ids,'[]'::jsonb)||${JSON.stringify([String(question._id)])}::jsonb`,
      });
      applied ||= !!playerUpdate;
      const key = {
        matchId: question.matchId,
        matchQuestionId: question._id,
        userId: member.userId };
      try {
        await rows(this.nativeDb,sql`INSERT INTO public.arenaplayeranswers
          (match_id,match_question_id,user_id,is_correct,timed_out,earned_score,selected_answer,response_time_ms,answered_at,attempts,streak_at_answer)
          VALUES(${question.matchId}::uuid,${question._id}::uuid,${member.userId}::uuid,${won},${!question.winnerId},${questionScore},
            ${won?question.correctAnswer:null},${responseTimeMs},${question.resolvedAt},0,0)
          ON CONFLICT(match_id,match_question_id,user_id) DO UPDATE SET is_correct=EXCLUDED.is_correct,timed_out=EXCLUDED.timed_out,
            earned_score=EXCLUDED.earned_score,selected_answer=CASE WHEN ${won} THEN EXCLUDED.selected_answer ELSE arenaplayeranswers.selected_answer END,
            response_time_ms=EXCLUDED.response_time_ms,answered_at=EXCLUDED.answered_at,
            payload=arenaplayeranswers.payload-'isCorrect'-'timedOut'-'earnedScore'-'selectedAnswer'-'responseTimeMs'-'answeredAt'`);
      } catch (error) {
        // Nếu kết quả đã được resolver khác ghi trước thì bỏ qua duplicate key.
        if (!(
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === '23505'
        ))
          throw error;
        // Another resolver inserted the same immutable outcome concurrently.
      }
    }

    // Một request cạnh tranh đã resolve câu này trước thì không phát event trùng.
    if (!applied) return [];

    const updated = await this.players.select(sql`("match_id" = ${question.matchId})`);
    const earnedByUser = new Map<string, number>();
    for (const member of updated) {
      const answer = await this.answers.one(sql`("match_id" = ${question.matchId}) AND ("match_question_id" = ${question._id}) AND ("user_id" = ${member.userId})`);
      earnedByUser.set(String(member.userId), answer?.earnedScore ?? 0);
    }
    return [
      {
        event: 'match:question-resolved',
        data: {
          matchId,
          questionId,
          winnerId: question.winnerId ? String(question.winnerId) : null,
          timedOut: !question.winnerId,
          correctAnswer: question.correctAnswer,
          players: updated.map((member) => ({
            userId: String(member.userId),
            score: member.score,
            streak: member.currentStreak,
            earnedScore: earnedByUser.get(String(member.userId)) ?? 0 })),
          explanation: question.explanation,
          example: question.example,
          translation: question.translation,
          type: question.wordType,
          nextQuestionAt: new Date(
            question.resolvedAt!.getTime() + 3000,
          ).toISOString() } },
      {
        event: 'match:score-update',
        data: {
          matchId,
          players: updated.map((member) => ({
            userId: String(member.userId),
            score: member.score,
            streak: member.currentStreak })) } },
    ];
  }

  /**
   * Quét các trận đang chơi để xử lý timeout, chuyển câu và kết thúc trận.
   * Đồng hồ dựa trên database nên vẫn hoạt động khi client mất kết nối.
   */
  async tick(): Promise<{ matchId: string; events: ArenaRoundEvent[] }[]> {
    const matches = await this.matches.select(sql`("status" = ${ArenaMatchStatus.PLAYING}) AND (("friend_mode" IS NULL OR NOT ("friend_mode"=ANY(${[ArenaFriendMode.WORD_CHAIN, ArenaFriendMode.WORD_GUESS]}::text[]))))`);
    const batches: { matchId: string; events: ArenaRoundEvent[] }[] = [];
    for (const match of matches) {
      try {
        batches.push({
          matchId: String(match._id),
          events: await this.advance(String(match._id)) });
      } catch (error) {
        // Một trận lỗi không được làm dừng việc xử lý các trận còn lại.
        this.logger.error(
          `Round failed for match ${String(match._id)}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return batches;
  }

  /** Khôi phục event hiện tại để client mới kết nối hoặc reload có thể tiếp tục trận. */
  async snapshot(matchId: string): Promise<ArenaRoundEvent[]> {
    const match = await this.matches.one(sql`id=${this.id(matchId)}::uuid`);

    // Không thể khôi phục trạng thái nếu trận không tồn tại.
    if (!match) throw new WsException('Match not found');

    // Trận đã kết thúc chỉ cần gửi kết quả cuối cùng, không tạo lại vòng chơi.
    if (match.status === ArenaMatchStatus.FINISHED)
      return [await this.finishedEvent(matchId)];

    const events = await this.advance(matchId);
    const question = await this.questions.one(sql`("match_id" = ${match._id}) AND ("order" = ${match.currentQuestionIndex ?? 1})`);
    if (
      question?.resolvedAt &&
      !events.some((e) => e.event === 'match:question-resolved')
    ) {
      const players = await this.players.select(sql`("match_id" = ${match._id})`);
      const earnedByUser = new Map<string, number>();
      for (const player of players) {
        const answer = await this.answers.one(sql`("match_id" = ${match._id}) AND ("match_question_id" = ${question._id}) AND ("user_id" = ${player.userId})`);
        earnedByUser.set(String(player.userId), answer?.earnedScore ?? 0);
      }
      events.push({
        event: 'match:question-resolved',
        data: {
          matchId,
          questionId: String(question._id),
          winnerId: question.winnerId ? String(question.winnerId) : null,
          timedOut: !question.winnerId,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          example: question.example,
          translation: question.translation,
          type: question.wordType,
          players: players.map((p) => ({
            userId: String(p.userId),
            score: p.score,
            streak: p.currentStreak,
            earnedScore: earnedByUser.get(String(p.userId)) ?? 0 })) } });
    }
    return events;
  }

  /**
   * Tiến trình một vòng chơi: phát câu hỏi, tạo hint, resolve timeout,
   * chuyển sang câu tiếp theo hoặc đóng trận khi đã hết câu.
   */
  async advanceTo(matchId: string, at = Date.now()): Promise<ArenaRoundEvent[]> {
    return this.advance(matchId, at);
  }
  private async advance(matchId: string, at = Date.now()): Promise<ArenaRoundEvent[]> {
    const work = async () => this.versionEvents(matchId, await this.advanceLocked(matchId, at));
    if (this.transactions) return this.transactions.run(matchId, work);
    return work();
  }
  private async versionEvents(matchId: string, events: ArenaRoundEvent[]) {
    if (!events.length) return events;
    const match = await this.matches.one(sql`id=${this.id(matchId)}::uuid`);
    if (match?.type !== ArenaMatchType.RANK) return events;
    return events.map(event => ({ ...event, data: { ...event.data, version: match.rankedState?.version ?? 0 } }));
  }
  private pauseDue(match: ArenaMatch, at: number) {
    if (match.type !== ArenaMatchType.RANK || !match.rankedState) return false;
    const rules = { ...ARENA_DEFAULTS.rankedConnection, ...match.runtimePolicy?.rankedConnection };
    return rules.rankedPauseEnabled && Object.values(match.rankedState.members).some(member =>
      member.disconnectedAt !== null && at > member.disconnectedAt+rules.reloadGraceSeconds*1000);
  }
  private async advanceLocked(matchId: string, at: number): Promise<ArenaRoundEvent[]> {
    const match = await this.matches.one(sql`id=${this.id(matchId)}::uuid`);

    // Chỉ trận đang PLAYING mới được phép tiến hành vòng chơi.
    if (!match || match.status !== ArenaMatchStatus.PLAYING) return [];
    if (this.pauseDue(match, at)) return [];

    let question = await this.questions.one(sql`("match_id" = ${match._id}) AND ("order" = ${match.currentQuestionIndex ?? 1})`);

    // Câu hỏi có thể chưa được tạo xong ngay sau khi trận bắt đầu.
    if (!question) return [];

    // Gán thời điểm bắt đầu một lần duy nhất để mọi client dùng chung deadline.
    if (!question.startedAt) {
      question =
        (await this.questions.patch(sql`("id" = ${question._id}) AND ("started_at" IS NULL)`,{ startedAt: new Date(at) })) ?? (await this.questions.one(sql`id=${question._id}::uuid`));

      // Nếu vẫn chưa có thời điểm bắt đầu thì chờ lần tick tiếp theo.
      if (!question?.startedAt) return [];
    }
    const now = at;

    // Khi hết thời gian, đóng câu hỏi với winnerId null để biểu thị timeout/hòa câu.
    if (
      !question.resolvedAt &&
      now >= question.startedAt.getTime() + match.secondsPerQuestion * 1000
    ) {
      question =
        (await this.questions.patch(sql`("id" = ${question._id}) AND ("resolved_at" IS NULL)`,{ resolvedAt: new Date(question.startedAt.getTime() + match.secondsPerQuestion * 1000), winnerId: null })) ?? (await this.questions.one(sql`id=${question._id}::uuid`));

      // Nếu câu hỏi đã bị xóa hoặc không lấy lại được thì không phát event lỗi.
      if (!question) return [];
    }
    const events: ArenaRoundEvent[] = [
      {
        event: 'match:question',
        data: {
          matchId,
          questionId: String(question._id),
          questionIndex: question.order,
          totalQuestions: match.questionCount,
          meaning: maskArenaAnswer(question.question, question.correctAnswer),
          explanation: maskArenaAnswer(
            question.explanation,
            question.correctAnswer,
          ),
          example: maskArenaAnswer(question.example, question.correctAnswer),
          translation: maskArenaAnswer(
            question.translation,
            question.correctAnswer,
          ),
          type: question.wordType,
          answerLength: Array.from(question.correctAnswer).length,
          image: question.imageUrl,
          startedAt: question.startedAt!.toISOString(),
          timeLimit: match.secondsPerQuestion } },
    ];

    // Câu chưa resolve tiếp tục phát hint và chưa được cộng điểm.
    if (!question.resolvedAt) {
      events.push({
        event: 'match:hint',
        data: {
          matchId,
          questionId: String(question._id),
          letters: arenaHintLetters(
            question.correctAnswer,
            now - question.startedAt!.getTime(),
            match.secondsPerQuestion * 1000,
            match.runtimePolicy?.hints,
          ) } });
      return events;
    }

    // Câu đã resolve: gửi kết quả, chờ 3 giây rồi mới chuyển câu.
    events.push(...(await this.resolutionEvents(match, question)));

    // Khoảng nghỉ giúp người chơi đọc đáp án và phần giải thích.
    if (now < question.resolvedAt.getTime() + 3000) return events;

    // Nếu còn câu, tăng chỉ số câu hiện tại rồi tiếp tục xử lý.
    if (question.order < match.questionCount) {
      const moved=await this.matches.patch(sql`id=${match._id}::uuid AND status=${ArenaMatchStatus.PLAYING} AND current_question_index=${question.order}`,{},
        {currentQuestionIndex:sql`current_question_index+1`});

      // Chỉ request cập nhật thành công mới được phép mở câu tiếp theo.
      if (moved) events.push(...(await this.advance(matchId, at)));
    } else {
      // Giao việc tính Elo và cập nhật profile cho một service có khóa FINISHING.
      const finished = await this.matchService.finishRankedMatch(matchId);

      // Chỉ request hoàn tất được match mới phát event kết thúc.
      if (finished) {
        events.push(await this.finishedEvent(matchId));
      }
    }
    return events;
  }

  /** Tạo event chứa kết quả cuối trận cho các client trong match room. */
  async finishedEvent(matchId: string): Promise<ArenaRoundEvent> {
    const [match, players] = await Promise.all([
      this.matches.one(sql`id=${this.id(matchId)}::uuid`),
      this.players.select(sql`("match_id" = ${this.id(matchId)})`),
    ]);
    if (match?.status === ArenaMatchStatus.CANCELLED && match.type !== ArenaMatchType.RANK)
      return {
        event: 'friend:cancelled',
        data: { matchId, message: match.cancelReason } };
    return {
      event:
        match?.type === ArenaMatchType.FRIEND ||
        match?.type === ArenaMatchType.ROOM
          ? 'friend:match-finished'
          : 'match:finished',
      data: {
        matchId,
        winnerId: match?.winnerId ? String(match.winnerId) : null,
        isDraw: match?.status === ArenaMatchStatus.CANCELLED || (match?.isDraw ?? true),
        cancelled: match?.status === ArenaMatchStatus.CANCELLED,
        version: match?.rankedState?.version ?? 0,
        finishReason: match?.finishReason ?? 'NORMAL',
        mode: match?.friendMode,
        turnCount: match?.turnCount ?? 0,
        requiredLetter:
          match?.friendMode === ArenaFriendMode.WORD_CHAIN
            ? (match.currentWord ?? '').slice(-1)
            : (match?.requiredLetter ?? ''),
        usedWords: match?.usedWords ?? [],
        startedAt: match?.startedAt?.toISOString(),
        finishedAt: match?.finishedAt?.toISOString(),
        players: players.map((player) => ({
          userId: String(player.userId),
          score: player.score,
          ...(match?.type === ArenaMatchType.RANK
            ? {
                ratingBefore: player.ratingBefore,
                ratingAfter: player.ratingAfter,
                ratingChange: player.ratingChange }
            : {}) })) } };
  }
}
