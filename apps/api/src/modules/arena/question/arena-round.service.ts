import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { WsException } from '@nestjs/websockets';
import { Model, Types } from 'mongoose';
import {
  ArenaMatch,
  ArenaMatchStatus,
  ArenaFriendMode,
  ArenaMatchType,
} from '../schemas/arena-match.schema.js';
import {
  ArenaMatchQuestion,
  ArenaMatchQuestionDocument,
} from '../schemas/arena-match-question.schema.js';
import { ArenaMatchPlayer } from '../schemas/arena-match-player.schema.js';
import { ArenaPlayerAnswer } from '../schemas/arena-player-answer.schema.js';
import {
  arenaHintLetters,
  maskArenaAnswer,
  normalizeArenaAnswer,
} from './arena-round.utils.js';
import { ArenaScoringService } from '../scoring/arena-scoring.service.js';
import { ArenaMatchService } from '../matches/arena-match.service.js';

export type ArenaRoundEvent = { event: string; data: Record<string, unknown> };

@Injectable()
export class ArenaRoundService {
  private readonly logger = new Logger(ArenaRoundService.name);
  constructor(
    @InjectModel(ArenaMatch.name) private readonly matches: Model<ArenaMatch>,
    @InjectModel(ArenaMatchQuestion.name)
    private readonly questions: Model<ArenaMatchQuestion>,
    @InjectModel(ArenaMatchPlayer.name)
    private readonly players: Model<ArenaMatchPlayer>,
    @InjectModel(ArenaPlayerAnswer.name)
    private readonly answers: Model<ArenaPlayerAnswer>,
    private readonly arenaScoreService: ArenaScoringService,
    private readonly matchService: ArenaMatchService,
  ) {}

  /** Kiểm tra chuỗi ID hợp lệ trước khi chuyển sang ObjectId của MongoDB. */
  private id(value: string) {
    // Từ chối ID sai định dạng để tránh truy vấn không hợp lệ hoặc gây lỗi Mongoose.
    if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))
      throw new WsException('Invalid ID');
    return new Types.ObjectId(value);
  }

  /** Đảm bảo người dùng là thành viên của trận đấu trước khi thực hiện thao tác. */
  async assertMember(matchId: string, userId: string) {
    const member = await this.players.exists({
      matchId: this.id(matchId),
      userId: this.id(userId),
    });

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
    const { matchId, questionId, userId, answer } = payload;

    // Giới hạn độ dài đáp án để tránh dữ liệu bất thường từ client.
    if (typeof answer !== 'string' || answer.length > 200)
      throw new WsException('Invalid answer');

    const matchObjectId = this.id(matchId);
    const userObjectId = this.id(userId);
    const [match, player, question] = await Promise.all([
      this.matches.findById(matchObjectId),
      this.players.findOne({ matchId: matchObjectId, userId: userObjectId }),
      this.questions.findOne({
        _id: this.id(questionId),
        matchId: matchObjectId,
      }),
    ]);

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
        (await this.questions.findOneAndUpdate(
          { _id: question._id, resolvedAt: null },
          {
            $set: { resolvedAt: now, winnerId: correct ? userObjectId : null },
          },
          { returnDocument: 'after' },
        )) ??
        (await this.questions.findById(question._id)) ??
        question;
    }

    // Khi câu đã đóng, cập nhật điểm và trả đáp án đúng cùng phần giải thích cho client.
    if (resolved.resolvedAt) {
      const events = await this.resolutionEvents(match, resolved);
      const updated = await this.players.findOne({
        matchId: matchObjectId,
        userId: userObjectId,
      });
      const answerRecord = await this.answers.findOne({
        matchId: matchObjectId,
        matchQuestionId: resolved._id,
        userId: userObjectId,
      });
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
          streak: updated?.currentStreak ?? player.currentStreak,
        },
      };
    }

    // Đáp án sai chỉ ghi nhận lượt thử; người chơi vẫn có thể trả lời lại câu này.
    const key = {
      matchId: matchObjectId,
      matchQuestionId: question._id,
      userId: userObjectId,
    };
    try {
      await this.answers.findOneAndUpdate(
        { ...key, isCorrect: { $ne: true } },
        {
          $set: {
            selectedAnswer: answer.trim(),
            isCorrect: false,
            answeredAt: now,
            responseTimeMs: Math.max(
              0,
              now.getTime() - question.startedAt.getTime(),
            ),
          },
          $inc: { attempts: 1 },
          $setOnInsert: key,
        },
        { upsert: true },
      );
    } catch (error) {
      // Lỗi duplicate có thể xảy ra khi nhiều request ghi cùng một đáp án đồng thời.
      // Các lỗi khác phải được ném tiếp để không che giấu lỗi hệ thống.
      if (!(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 11000
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
        streak: player.currentStreak,
      },
    };
  }

  /**
   * Cập nhật kết quả của một câu cho tất cả người chơi và tạo các event realtime.
   * scoredQuestionIds bảo đảm một câu chỉ được cộng điểm một lần.
   */
  private async resolutionEvents(
    match: ArenaMatch,
    question: ArenaMatchQuestionDocument,
  ): Promise<ArenaRoundEvent[]> {
    const matchId = String(question.matchId);
    const questionId = String(question._id);
    const members = await this.players.find({ matchId: question.matchId });
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
      const answerRecord = await this.answers.findOne({
        matchId: question.matchId,
        matchQuestionId: question._id,
        userId: member.userId,
      });
      const wrongAttempts = Math.max(
        0,
        (answerRecord?.attempts ?? 0) - (won ? 1 : 0),
      );
      const questionScore = won
        ? this.arenaScoreService.calculateQuestionScore({
            timeLimitMs: match.secondsPerQuestion * 1000,
            elapsedMs: responseTimeMs,
            wrongAttempts,
          })
        : 0;
      const hasAnswered = (answerRecord?.attempts ?? 0) > 0;

      // Người thắng tăng điểm và streak; người còn lại bị reset streak về 0.
      const streak = won
        ? { $add: [{ $ifNull: ['$currentStreak', 0] }, 1] }
        : 0;
      const playerUpdate = await this.players.updateOne(
        { _id: member._id, scoredQuestionIds: { $ne: question._id } },
        [
          {
            $set: {
              score: { $add: [{ $ifNull: ['$score', 0] }, questionScore] },
              correctAnswers: {
                $add: [{ $ifNull: ['$correctAnswers', 0] }, won ? 1 : 0],
              },
              wrongAnswers: {
                $add: [
                  { $ifNull: ['$wrongAnswers', 0] },
                  !won && hasAnswered ? 1 : 0,
                ],
              },
              unanswered: {
                $add: [
                  { $ifNull: ['$unanswered', 0] },
                  !won && !hasAnswered ? 1 : 0,
                ],
              },
              currentStreak: streak,
              longestStreak: {
                $max: [{ $ifNull: ['$longestStreak', 0] }, streak],
              },
              totalResponseTimeMs: {
                $add: [
                  { $ifNull: ['$totalResponseTimeMs', 0] },
                  hasAnswered ? responseTimeMs : 0,
                ],
              },
              scoredQuestionIds: {
                $concatArrays: [
                  { $ifNull: ['$scoredQuestionIds', []] },
                  [question._id],
                ],
              },
            },
          },
        ],
        { updatePipeline: true },
      );
      applied ||= playerUpdate.modifiedCount > 0;
      const key = {
        matchId: question.matchId,
        matchQuestionId: question._id,
        userId: member.userId,
      };
      try {
        await this.answers.updateOne(
          key,
          {
            $set: {
              isCorrect: won,
              timedOut: !question.winnerId,
              earnedScore: questionScore,
              ...(won ? { selectedAnswer: question.correctAnswer } : {}),
              responseTimeMs,
              answeredAt: question.resolvedAt,
            },
            $setOnInsert: key,
          },
          { upsert: true },
        );
      } catch (error) {
        // Nếu kết quả đã được resolver khác ghi trước thì bỏ qua duplicate key.
        if (!(
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 11000
        ))
          throw error;
        // Another resolver inserted the same immutable outcome concurrently.
      }
    }

    // Một request cạnh tranh đã resolve câu này trước thì không phát event trùng.
    if (!applied) return [];

    const updated = await this.players.find({ matchId: question.matchId });
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
          })),
          explanation: question.explanation,
          example: question.example,
          translation: question.translation,
          type: question.wordType,
          nextQuestionAt: new Date(
            question.resolvedAt!.getTime() + 3000,
          ).toISOString(),
        },
      },
      {
        event: 'match:score-update',
        data: {
          matchId,
          players: updated.map((member) => ({
            userId: String(member.userId),
            score: member.score,
            streak: member.currentStreak,
          })),
        },
      },
    ];
  }

  /**
   * Quét các trận đang chơi để xử lý timeout, chuyển câu và kết thúc trận.
   * Đồng hồ dựa trên database nên vẫn hoạt động khi client mất kết nối.
   */
  async tick(): Promise<{ matchId: string; events: ArenaRoundEvent[] }[]> {
    const matches = await this.matches.find({
      status: ArenaMatchStatus.PLAYING,
      friendMode: {
        $nin: [ArenaFriendMode.WORD_CHAIN, ArenaFriendMode.WORD_GUESS],
      },
    });
    const batches: { matchId: string; events: ArenaRoundEvent[] }[] = [];
    for (const match of matches) {
      try {
        batches.push({
          matchId: String(match._id),
          events: await this.advance(String(match._id)),
        });
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
    const match = await this.matches.findById(this.id(matchId));

    // Không thể khôi phục trạng thái nếu trận không tồn tại.
    if (!match) throw new WsException('Match not found');

    // Trận đã kết thúc chỉ cần gửi kết quả cuối cùng, không tạo lại vòng chơi.
    if (match.status === ArenaMatchStatus.FINISHED)
      return [await this.finishedEvent(matchId)];

    const events = await this.advance(matchId);
    const question = await this.questions.findOne({
      matchId: match._id,
      order: match.currentQuestionIndex ?? 1,
    });
    if (
      question?.resolvedAt &&
      !events.some((e) => e.event === 'match:question-resolved')
    ) {
      const players = await this.players.find({ matchId: match._id });
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
          })),
        },
      });
    }
    return events;
  }

  /**
   * Tiến trình một vòng chơi: phát câu hỏi, tạo hint, resolve timeout,
   * chuyển sang câu tiếp theo hoặc đóng trận khi đã hết câu.
   */
  private async advance(matchId: string): Promise<ArenaRoundEvent[]> {
    const match = await this.matches.findById(this.id(matchId));

    // Chỉ trận đang PLAYING mới được phép tiến hành vòng chơi.
    if (!match || match.status !== ArenaMatchStatus.PLAYING) return [];

    let question = await this.questions.findOne({
      matchId: match._id,
      order: match.currentQuestionIndex ?? 1,
    });

    // Câu hỏi có thể chưa được tạo xong ngay sau khi trận bắt đầu.
    if (!question) return [];

    // Gán thời điểm bắt đầu một lần duy nhất để mọi client dùng chung deadline.
    if (!question.startedAt) {
      question =
        (await this.questions.findOneAndUpdate(
          { _id: question._id, startedAt: null },
          { $set: { startedAt: new Date() } },
          { returnDocument: 'after' },
        )) ?? (await this.questions.findById(question._id));

      // Nếu vẫn chưa có thời điểm bắt đầu thì chờ lần tick tiếp theo.
      if (!question?.startedAt) return [];
    }
    const now = Date.now();

    // Khi hết thời gian, đóng câu hỏi với winnerId null để biểu thị timeout/hòa câu.
    if (
      !question.resolvedAt &&
      now >= question.startedAt.getTime() + match.secondsPerQuestion * 1000
    ) {
      question =
        (await this.questions.findOneAndUpdate(
          { _id: question._id, resolvedAt: null },
          { $set: { resolvedAt: new Date(), winnerId: null } },
          { returnDocument: 'after' },
        )) ?? (await this.questions.findById(question._id));

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
          timeLimit: match.secondsPerQuestion,
        },
      },
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
          ),
        },
      });
      return events;
    }

    // Câu đã resolve: gửi kết quả, chờ 3 giây rồi mới chuyển câu.
    events.push(...(await this.resolutionEvents(match, question)));

    // Khoảng nghỉ giúp người chơi đọc đáp án và phần giải thích.
    if (now < question.resolvedAt.getTime() + 3000) return events;

    // Nếu còn câu, tăng chỉ số câu hiện tại rồi tiếp tục xử lý.
    if (question.order < match.questionCount) {
      const moved = await this.matches.updateOne(
        {
          _id: match._id,
          status: ArenaMatchStatus.PLAYING,
          currentQuestionIndex: question.order,
        },
        { $inc: { currentQuestionIndex: 1 } },
      );

      // Chỉ request cập nhật thành công mới được phép mở câu tiếp theo.
      if (moved.modifiedCount) events.push(...(await this.advance(matchId)));
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
      this.matches.findById(this.id(matchId)),
      this.players.find({ matchId: this.id(matchId) }),
    ]);
    if (match?.status === ArenaMatchStatus.CANCELLED)
      return {
        event: 'friend:cancelled',
        data: { matchId, message: match.cancelReason },
      };
    return {
      event:
        match?.type === ArenaMatchType.FRIEND ||
        match?.type === ArenaMatchType.ROOM
          ? 'friend:match-finished'
          : 'match:finished',
      data: {
        matchId,
        winnerId: match?.winnerId ? String(match.winnerId) : null,
        isDraw: match?.isDraw ?? true,
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
                ratingChange: player.ratingChange,
              }
            : {}),
        })),
      },
    };
  }
}
