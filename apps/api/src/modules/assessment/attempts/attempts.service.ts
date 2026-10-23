import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { toeicAttemptXp } from '@repo/shared-types/learning-xp';
import { LearningActivityClient } from '../../../common/clients/learning-activity-client.js';
import type { LearningActivityWriter } from '../../learning-activity/learning-activity.service.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateAttemptDto } from './dto/create-attempt.dto.js';
import {
  AudioPlayDto,
  SaveAnswerDto,
  UpdateAttemptDto,
} from './dto/update-attempt.dto.js';
import { Attempt } from './schemas/attempt.schema.js';
import { Exam } from '../exams/schemas/exam.schema.js';
import { Question } from '../questions/schemas/question.schema.js';
import { Passage } from '../questions/schemas/passage.schema.js';
import { ExamMode, ToeicAttemptStatus } from './attempt.types.js';
import type { SnapshotQuestion } from './attempt.types.js';
import {
  buildAttemptResultPipeline,
  COMPLETED_STATUSES,
} from './attempt-results.js';
import {
  estimateToeicScore,
  TOEIC_SCORE_BANDS,
  toeicScoreBand,
  TOEIC_TOTAL_MAX,
} from '@repo/shared-types/toeic-score';
import type {
  QueryAttemptDto,
  AdminQueryAttemptDto,
} from './dto/query-attempt.dto.js';

export function publicQuestion(question: SnapshotQuestion, review = false) {
  const {
    _id,
    part,
    content,
    options,
    imageUrl,
    audioUrl,
    passageGroupId,
    passages = [],
  } = question;
  return {
    _id,
    part,
    // Part 1/2 content and option text contain the spoken script, not a
    // printed question. Never include that script in an unfinished attempt.
    content: part <= 2 && !review ? '' : content,
    options: options.map(({ key, text }) => ({
      key,
      text: part <= 2 && !review ? '' : text,
    })),
    imageUrl,
    audioUrl,
    passageGroupId,
    passages: passages.map(({ _id, content, imageUrl, audioUrl }) => ({
      _id,
      content: part <= 4 && !review ? undefined : content,
      imageUrl,
      audioUrl,
    })),
    ...(review
      ? {
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          transcript: question.transcript || (part <= 2 ? content : undefined),
        }
      : {}),
  };
}

// TOEIC pacing: 45 minutes per 100 Listening and 75 per 100 Reading questions.
const LISTENING_SECONDS_PER_QUESTION = 27;
const READING_SECONDS_PER_QUESTION = 45;
// Network slack before a late answer/expired attempt is enforced server-side.
export const TIME_LIMIT_GRACE_MS = 30_000;

export function testTimeLimitSeconds(
  questions: { part: number }[],
  selectedParts: number[],
  examDurationMinutes?: number,
) {
  if (selectedParts.length === 7 && examDurationMinutes)
    return examDurationMinutes * 60;
  const seconds = questions.reduce(
    (sum, q) =>
      sum +
      (q.part <= 4
        ? LISTENING_SECONDS_PER_QUESTION
        : READING_SECONDS_PER_QUESTION),
    0,
  );
  return Math.max(60, Math.ceil(seconds / 60) * 60);
}

// What a learner may see about one question once it has been answered in
// PRACTICE mode (TEST mode only reveals this after submission).
export function answerFeedback(question: SnapshotQuestion, answer: string) {
  return {
    correct: answer === question.correctAnswer,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    transcript:
      question.transcript ||
      (question.part <= 2 ? question.content : undefined),
  };
}

@Injectable()
export class AttemptsService {
  constructor(
    @InjectModel(Attempt.name) private readonly attempts: Model<Attempt>,
    @InjectModel(Exam.name) private readonly exams: Model<Exam>,
    @InjectModel(Question.name) private readonly questions: Model<Question>,
    @InjectModel(Passage.name) private readonly passages: Model<Passage>,
    @Optional()
    @Inject(LearningActivityClient) private readonly learningActivity?: LearningActivityWriter,
  ) {}

  async availableParts(idOrSlug: string) {
    const exam = await this.exams
      .findOne({
        ...(Types.ObjectId.isValid(idOrSlug)
          ? { _id: idOrSlug }
          : { slug: idOrSlug }),
        type: 'TOEIC',
        isDeleted: { $ne: true },
        isActive: { $ne: false },
      })
      .lean()
      .exec();
    if (!exam) throw new NotFoundException('Exam not found');
    const rows = await this.questions
      .aggregate<{ _id: number; totalQuestions: number }>([
        { $match: { examId: exam._id, isActive: { $ne: false } } },
        { $group: { _id: '$part', totalQuestions: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .exec();
    const names = [
      '',
      'Photographs',
      'Question-Response',
      'Conversations',
      'Talks',
      'Incomplete Sentences',
      'Text Completion',
      'Reading Comprehension',
    ];
    return rows.map((row) => ({
      _id: String(row._id),
      part: row._id,
      section: row._id <= 4 ? 'LISTENING' : 'READING',
      type: names[row._id],
      totalQuestions: row.totalQuestions,
    }));
  }

  private objectId(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid id');
    return new Types.ObjectId(id);
  }

  private async owned(userId: string, id: string) {
    const attempt = await this.attempts
      .findOne({ _id: this.objectId(id), userId: this.objectId(userId) })
      .select('+questionSnapshot')
      .lean()
      .exec();
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (!attempt.questionSnapshot?.length)
      throw new ConflictException(
        'This legacy attempt has no question snapshot. Please start a new attempt.',
      );
    return attempt;
  }

  private inProgress(attempt: Attempt) {
    if (attempt.status !== ToeicAttemptStatus.IN_PROGRESS)
      throw new ConflictException('Attempt is no longer in progress');
  }

  private summary(attempt: any) {
    const {
      questionSnapshot: _questionSnapshot,
      __v: _version,
      ...summary
    } = attempt;
    const answers = attempt.answers ?? {};
    const answeredQuestions =
      attempt.answers != null
        ? Object.keys(answers).length
        : (attempt.answeredQuestions ?? 0);
    const finished = COMPLETED_STATUSES.includes(attempt.status);
    // Only full-test mode gets the (estimated) scaled TOEIC score.
    const scaled =
      finished && attempt.mode === ExamMode.TEST
        ? estimateToeicScore(attempt.listeningResult, attempt.readingResult)
        : null;
    const correct = attempt.correctAnswers ?? attempt.totalCorrect ?? 0;
    const total = attempt.totalQuestions ?? 0;
    return {
      ...summary,
      examId: attempt.examId || attempt.examSnapshot || null,
      answers,
      audioPlayCounts: attempt.audioPlayCounts ?? {},
      answeredQuestions,
      correctAnswers: finished ? correct : undefined,
      totalCorrect: finished ? correct : undefined,
      incorrectAnswers: finished
        ? (attempt.incorrectAnswers ?? Math.max(0, answeredQuestions - correct))
        : undefined,
      unansweredQuestions: Math.max(0, total - answeredQuestions),
      accuracy: finished
        ? (attempt.accuracy ??
          (total ? Math.round((correct / total) * 10000) / 100 : 0))
        : undefined,
      partResults: finished ? attempt.partResults : undefined,
      listeningResult: finished ? attempt.listeningResult : undefined,
      readingResult: finished ? attempt.readingResult : undefined,
      listeningCorrect: finished ? attempt.listeningCorrect : undefined,
      readingCorrect: finished ? attempt.readingCorrect : undefined,
      resultType: scaled ? 'ESTIMATED' : 'RAW',
      score: scaled?.total,
      scoreMax: scaled?.max,
      listeningScore: scaled?.listening ?? undefined,
      readingScore: scaled?.reading ?? undefined,
    };
  }

  async create(userId: string, dto: CreateAttemptDto) {
    if (
      !Object.values(ExamMode).includes(dto.mode) ||
      !Array.isArray(dto.selectedParts) ||
      !dto.selectedParts.length ||
      new Set(dto.selectedParts).size !== dto.selectedParts.length ||
      dto.selectedParts.some((p) => !Number.isInteger(p) || p < 1 || p > 7)
    ) {
      throw new BadRequestException(
        'Choose TEST or PRACTICE and unique available Parts',
      );
    }
    const exam = await this.exams
      .findOne({
        _id: this.objectId(dto.examId),
        type: 'TOEIC',
        isDeleted: { $ne: true },
        isActive: { $ne: false },
      })
      .lean()
      .exec();
    if (!exam) throw new NotFoundException('Exam not found');
    const questions = await this.questions
      .find({
        examId: exam._id,
        isActive: { $ne: false },
        part: { $in: dto.selectedParts },
      })
      .sort({ part: 1, order: 1, sourceOrder: 1, _id: 1 })
      .lean()
      .exec();
    if (dto.selectedParts.some((p) => !questions.some((q) => q.part === p)))
      throw new BadRequestException('Part is not available in this exam');
    const groupIds = questions.flatMap((q) =>
      q.passageGroupId ? [q.passageGroupId] : [],
    );
    const passages = await this.passages
      .find({ passageGroupId: { $in: groupIds } })
      .sort({ order: 1, _id: 1 })
      .lean()
      .exec();
    const transcript = (meta: any) =>
      meta?.segments
        ?.map((s: any) => s.text)
        .filter(Boolean)
        .join('\n') || '';
    const questionSnapshot: SnapshotQuestion[] = questions.map((q) => {
      const group = passages.filter(
        (p) => String(p.passageGroupId) === String(q.passageGroupId),
      );
      return {
        _id: String(q._id),
        part: q.part,
        content: q.content,
        options: q.options.map((o) => ({ key: o.key, text: o.text })),
        imageUrl: q.imageUrl,
        audioUrl: q.audioUrl,
        passageGroupId: q.passageGroupId ? String(q.passageGroupId) : undefined,
        // Listening passage text is a transcript, not a reading prompt.
        passages: group.map((p) => ({
          _id: String(p._id),
          content: q.part >= 5 ? p.content : undefined,
          imageUrl: p.imageUrl,
          audioUrl: p.audioUrl,
        })),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        transcript: [
          transcript(q.audioMeta) || (q.part <= 2 ? q.content : ''),
          ...group.map(
            (p) => transcript(p.audioMeta) || (q.part <= 4 ? p.content : ''),
          ),
        ]
          .filter(Boolean)
          .join('\n'),
      };
    });
    const timeLimitSeconds =
      dto.mode === ExamMode.TEST
        ? testTimeLimitSeconds(
            questions,
            dto.selectedParts,
            exam.durationMinutes,
          )
        : undefined;
    const startedAt = new Date();
    const attempt = await this.attempts.create({
      userId: this.objectId(userId),
      examId: exam._id,
      examSnapshot: { _id: String(exam._id), name: exam.name, slug: exam.slug },
      mode: dto.mode,
      selectedParts: [...dto.selectedParts].sort((a, b) => a - b),
      questionSnapshot,
      status: ToeicAttemptStatus.IN_PROGRESS,
      startedAt,
      timeLimitSeconds,
      expiresAt: timeLimitSeconds
        ? new Date(startedAt.getTime() + timeLimitSeconds * 1000)
        : undefined,
      totalQuestions: questions.length,
    });
    return { _id: String(attempt._id) };
  }

  private async listFilter(
    userId: string | undefined,
    query: AdminQueryAttemptDto,
  ) {
    const filter: Record<string, unknown> = {};
    if (userId || query.userId)
      filter.userId = this.objectId(userId || query.userId!);
    if (query.mode) filter.mode = query.mode;
    if (query.status)
      filter.status =
        query.status === 'FINISHED'
          ? { $in: COMPLETED_STATUSES }
          : query.status;
    if (query.examId) {
      const examId = query.examId;
      const exam = await this.exams
        .findOne(
          Types.ObjectId.isValid(examId) ? { _id: examId } : { slug: examId },
        )
        .select('_id')
        .lean()
        .exec();
      filter.examId = exam?._id ?? { $in: [] };
    }
    return filter;
  }

  async findAll(userId: string, queryOrExam: QueryAttemptDto | string = {}) {
    const query =
      typeof queryOrExam === 'string' ? { examId: queryOrExam } : queryOrExam;
    const filter = await this.listFilter(userId, query);
    const limit = Math.max(1, Math.min(100, query.limit ?? 100));
    const rows = await this.attempts
      .find(filter)
      .populate('examId', 'name slug')
      .sort(
        query.sort === 'oldest'
          ? { createdAt: 1, _id: 1 }
          : { createdAt: -1, _id: -1 },
      )
      .skip(((query.page ?? 1) - 1) * limit)
      .limit(limit)
      .lean()
      .exec();
    return rows.map((row) => this.summary(row));
  }

  async adminList(query: AdminQueryAttemptDto = {}) {
    const filter = await this.listFilter(undefined, query);
    const page = query.page ?? 1;
    const limit = Math.max(1, Math.min(100, query.limit ?? 100));
    const [rows, total] = await Promise.all([
      this.attempts
        .find(filter)
        .populate('examId', 'name slug')
        .populate('userId', 'username email')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.attempts.countDocuments(filter).exec(),
    ]);
    return { data: rows.map((row) => this.summary(row)), total, page, limit };
  }

  async adminFindOne(id: string) {
    const attempt = await this.attempts
      .findById(this.objectId(id))
      .select('+questionSnapshot')
      .populate('examId', 'name slug')
      .populate('userId', 'username email')
      .lean()
      .exec();
    if (!attempt) throw new NotFoundException('Attempt not found');
    return {
      ...this.summary(attempt),
      hasSnapshot: Boolean(attempt.questionSnapshot?.length),
      questions:
        attempt.questionSnapshot?.map((q) => publicQuestion(q, true)) ?? [],
    };
  }

  async stats(userId?: string, query: AdminQueryAttemptDto = {}) {
    const baseFilter = await this.listFilter(userId, query);
    const dayMs = 24 * 60 * 60 * 1000;
    const since = query.days
      ? new Date(Date.now() - query.days * dayMs)
      : undefined;
    const filter = since
      ? { ...baseFilter, createdAt: { $gte: since } }
      : baseFilter;
    const timezone = query.timezone || 'UTC';
    const completed = { $in: ['$status', COMPLETED_STATUSES] };
    const completedValue = (value: unknown) => ({
      $cond: [completed, value, 0],
    });
    const correctValue = {
      $ifNull: ['$correctAnswers', { $ifNull: ['$totalCorrect', 0] }],
    };
    const accuracyValue = {
      $cond: [
        { $gt: ['$totalQuestions', 0] },
        { $multiply: [{ $divide: [correctValue, '$totalQuestions'] }, 100] },
        0,
      ],
    };
    const sectionAccuracy = (field: string) => ({
      $avg: {
        $cond: [
          { $and: [completed, { $gt: [`$${field}.total`, 0] }] },
          `$${field}.accuracy`,
          null,
        ],
      },
    });
    const overviewStage = {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        totalCompleted: { $sum: completedValue(1) },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0] },
        },
        testAttempts: {
          $sum: { $cond: [{ $eq: ['$mode', ExamMode.TEST] }, 1, 0] },
        },
        practiceAttempts: {
          $sum: { $cond: [{ $eq: ['$mode', ExamMode.PRACTICE] }, 1, 0] },
        },
        totalQuestions: { $sum: completedValue('$totalQuestions') },
        totalAnswered: { $sum: completedValue('$answeredQuestions') },
        totalCorrect: { $sum: completedValue(correctValue) },
        totalDuration: { $sum: completedValue('$durationSpent') },
        avgAccuracy: { $avg: { $cond: [completed, accuracyValue, null] } },
      },
    };
    const round2 = (value: number) => Math.round(value * 100) / 100;
    const shapeOverview = (overview: any = {}) => ({
      totalAttempts: overview.totalAttempts ?? 0,
      totalCompleted: overview.totalCompleted ?? 0,
      inProgress: overview.inProgress ?? 0,
      testAttempts: overview.testAttempts ?? 0,
      practiceAttempts: overview.practiceAttempts ?? 0,
      totalQuestions: overview.totalQuestions ?? 0,
      totalAnswered: overview.totalAnswered ?? 0,
      totalCorrect: overview.totalCorrect ?? 0,
      totalIncorrect: Math.max(
        0,
        (overview.totalAnswered ?? 0) - (overview.totalCorrect ?? 0),
      ),
      totalUnanswered: Math.max(
        0,
        (overview.totalQuestions ?? 0) - (overview.totalAnswered ?? 0),
      ),
      avgAccuracy: round2(overview.avgAccuracy ?? 0),
      totalDuration: overview.totalDuration ?? 0,
      avgDuration: overview.totalCompleted
        ? Math.round((overview.totalDuration ?? 0) / overview.totalCompleted)
        : 0,
    });
    const scoredFilter = (
      createdAt: unknown,
    ): Record<string, unknown> | null =>
      query.mode === ExamMode.PRACTICE
        ? null
        : {
            ...baseFilter,
            ...(createdAt ? { createdAt } : {}),
            mode: ExamMode.TEST,
            status: { $in: COMPLETED_STATUSES },
          };
    const findScored = (createdAt: unknown) => {
      const scoredQuery = scoredFilter(createdAt);
      return scoredQuery
        ? this.attempts
            .find(scoredQuery)
            .select('listeningResult readingResult selectedParts createdAt')
            .lean()
            .exec()
        : Promise.resolve([]);
    };
    const [result, recent, previous, scoredRows, previousScoredRows] =
      await Promise.all([
        this.attempts
          .aggregate([
            { $match: filter },
            {
              $facet: {
                overview: [overviewStage],
                parts: [
                  { $match: { status: { $in: COMPLETED_STATUSES } } },
                  { $unwind: '$partResults' },
                  {
                    $group: {
                      _id: '$partResults.part',
                      attempts: { $sum: 1 },
                      total: { $sum: '$partResults.total' },
                      answered: { $sum: '$partResults.answered' },
                      correct: { $sum: '$partResults.correct' },
                    },
                  },
                  { $sort: { _id: 1 } },
                ],
                timeline: [
                  {
                    $group: {
                      _id: {
                        $dateToString: {
                          format: '%Y-%m-%d',
                          date: '$createdAt',
                          timezone,
                        },
                      },
                      attempts: { $sum: 1 },
                      completed: { $sum: completedValue(1) },
                      duration: {
                        $sum: completedValue({
                          $ifNull: ['$durationSpent', 0],
                        }),
                      },
                      accuracy: {
                        $avg: { $cond: [completed, accuracyValue, null] },
                      },
                      listeningAccuracy: sectionAccuracy('listeningResult'),
                      readingAccuracy: sectionAccuracy('readingResult'),
                    },
                  },
                  { $sort: { _id: 1 } },
                ],
                // Raw-accuracy bands; there is no calibrated TOEIC scale yet.
                distribution: [
                  { $match: { status: { $in: COMPLETED_STATUSES } } },
                  {
                    $group: {
                      _id: {
                        $switch: {
                          branches: [
                            {
                              case: { $gte: [accuracyValue, 90] },
                              then: 'excellent',
                            },
                            {
                              case: { $gte: [accuracyValue, 75] },
                              then: 'good',
                            },
                            {
                              case: { $gte: [accuracyValue, 60] },
                              then: 'fair',
                            },
                            {
                              case: { $gte: [accuracyValue, 45] },
                              then: 'average',
                            },
                          ],
                          default: 'low',
                        },
                      },
                      count: { $sum: 1 },
                    },
                  },
                ],
              },
            },
          ])
          .exec(),
        this.attempts
          .find(filter)
          .populate('examId', 'name slug')
          .sort({ createdAt: -1, _id: -1 })
          .limit(5)
          .lean()
          .exec(),
        since
          ? this.attempts
              .aggregate([
                {
                  $match: {
                    ...baseFilter,
                    createdAt: {
                      $gte: new Date(since.getTime() - query.days! * dayMs),
                      $lt: since,
                    },
                  },
                },
                overviewStage,
              ])
              .exec()
          : Promise.resolve(null),
        findScored(since ? { $gte: since } : undefined),
        since
          ? findScored({
              $gte: new Date(since.getTime() - query.days! * dayMs),
              $lt: since,
            })
          : Promise.resolve([]),
      ]);
    const overview = result[0]?.overview[0] ?? {};
    const parts = (result[0]?.parts ?? []).map((part: any) => ({
      part: part._id,
      attempts: part.attempts,
      total: part.total,
      answered: part.answered,
      correct: part.correct,
      incorrect: Math.max(0, part.answered - part.correct),
      unanswered: Math.max(0, part.total - part.answered),
      accuracy: part.total
        ? Math.round((part.correct / part.total) * 10000) / 100
        : 0,
    }));
    const section = (listening: boolean) => {
      const rows = parts.filter((p: any) => p.part <= 4 === listening);
      const total = rows.reduce((sum: number, p: any) => sum + p.total, 0);
      const correct = rows.reduce((sum: number, p: any) => sum + p.correct, 0);
      const answered = rows.reduce(
        (sum: number, p: any) => sum + p.answered,
        0,
      );
      return {
        total,
        answered,
        correct,
        incorrect: Math.max(0, answered - correct),
        unanswered: Math.max(0, total - answered),
        accuracy: total ? Math.round((correct / total) * 10000) / 100 : 0,
      };
    };
    const distributionRows: { _id: string; count: number }[] =
      result[0]?.distribution ?? [];
    const optional = (value: number | null | undefined) =>
      value == null ? null : round2(value);
    const dayOf = new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    const scoredOf = (rows: any[]) =>
      rows.map((row) => ({
        date: dayOf.format(new Date(row.createdAt)),
        score: estimateToeicScore(row.listeningResult, row.readingResult),
        fullTest: row.selectedParts?.length === 7,
      }));
    const average = (values: number[]) =>
      values.length
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : null;
    // Total score is only comparable across full tests (both sections).
    const scoreSummary = (rows: ReturnType<typeof scoredOf>) => {
      const full = rows.flatMap((r) =>
        r.fullTest && r.score?.max === TOEIC_TOTAL_MAX ? [r.score.total] : [],
      );
      return {
        scoredAttempts: full.length,
        avgScore: average(full),
        highestScore: full.length ? Math.max(...full) : null,
        avgListeningScore: average(
          rows.flatMap((r) =>
            r.score?.listening != null ? [r.score.listening] : [],
          ),
        ),
        avgReadingScore: average(
          rows.flatMap((r) =>
            r.score?.reading != null ? [r.score.reading] : [],
          ),
        ),
      };
    };
    const scored = scoredOf(scoredRows);
    const scoresOn = (date: string) =>
      scoreSummary(scored.filter((r) => r.date === date));
    const scoreTotals = scoreSummary(scored);
    return {
      ...shapeOverview(overview),
      ...scoreTotals,
      scoreAvailable: scoreTotals.scoredAttempts > 0,
      days: query.days ?? null,
      previous: previous
        ? {
            ...shapeOverview(previous[0]),
            ...scoreSummary(scoredOf(previousScoredRows)),
          }
        : null,
      partResults: parts,
      listeningResult: section(true),
      readingResult: section(false),
      timeline: (result[0]?.timeline ?? []).map((day: any) => ({
        date: day._id,
        attempts: day.attempts,
        completed: day.completed,
        duration: day.duration,
        accuracy: optional(day.accuracy),
        listeningAccuracy: optional(day.listeningAccuracy),
        readingAccuracy: optional(day.readingAccuracy),
        avgScore: scoresOn(day._id).avgScore,
        avgListeningScore: scoresOn(day._id).avgListeningScore,
        avgReadingScore: scoresOn(day._id).avgReadingScore,
      })),
      scoreDistribution: TOEIC_SCORE_BANDS.map(({ band }) => ({
        band,
        count: scored.filter(
          (r) =>
            r.fullTest &&
            r.score?.max === TOEIC_TOTAL_MAX &&
            toeicScoreBand(r.score.total) === band,
        ).length,
      })),
      distribution: ['excellent', 'good', 'fair', 'average', 'low'].map(
        (band) => ({
          band,
          count: distributionRows.find((row) => row._id === band)?.count ?? 0,
        }),
      ),
      resultType: 'RAW',
      recentAttempts: recent.map((row) => this.summary(row)),
    };
  }

  private expired(attempt: Attempt) {
    return Boolean(
      attempt.status === ToeicAttemptStatus.IN_PROGRESS &&
      attempt.expiresAt &&
      new Date(attempt.expiresAt).getTime() + TIME_LIMIT_GRACE_MS < Date.now(),
    );
  }

  private async grade(attempt: Attempt & { _id: Types.ObjectId }) {
    // Grade inside one database update: concurrent saves either precede this update
    // and are counted, or fail their IN_PROGRESS condition after it.
    const result = await this.attempts
      .updateOne(
        { _id: attempt._id, status: ToeicAttemptStatus.IN_PROGRESS },
        buildAttemptResultPipeline(
          attempt.questionSnapshot,
          attempt.selectedParts,
        ),
        { updatePipeline: true },
      )
      .exec();
    // Only the request that actually graded the attempt records it.
    if (result.modifiedCount) await this.recordCompletion(attempt._id);
  }

  private async recordCompletion(id: Types.ObjectId) {
    if (!this.learningActivity) return;
    const graded = await this.attempts
      .findById(id)
      .select(
        'userId status examSnapshot mode selectedParts correctAnswers totalQuestions durationSpent submittedAt listeningResult readingResult',
      )
      .lean()
      .exec();
    if (!graded) return;
    const correct = graded.correctAnswers ?? 0;
    const score = this.summary(graded).score;
    await this.learningActivity.record({
      userId: graded.userId,
      module: 'TOEIC',
      type: 'TOEIC_ATTEMPT',
      sourceKey: `toeic:${id}`,
      xp: toeicAttemptXp(correct),
      occurredAt: graded.submittedAt,
      title: graded.examSnapshot?.name,
      refId: String(id),
      link: `/toeic/attempts/${id}/result`,
      correct,
      total: graded.totalQuestions,
      score,
      durationSec: graded.durationSpent,
      metadata: { mode: graded.mode, selectedParts: graded.selectedParts },
    });
  }

  async findOne(userId: string, id: string) {
    let attempt = await this.owned(userId, id);
    // A timed test left open past its deadline is graded on the next read.
    if (this.expired(attempt)) {
      await this.grade(attempt);
      attempt = await this.owned(userId, id);
    }
    const listening = attempt.questionSnapshot.filter((q) => q.part <= 4);
    // Audio can be uploaded/generated after an attempt starts, or replaced at a
    // new URL. Refresh only media; prompts, answer keys and grading stay frozen.
    const questions = listening.length
      ? await this.questions
          .find({
            _id: { $in: listening.map((q) => this.objectId(q._id)) },
            examId: attempt.examId,
          })
          .select('_id audioUrl passageGroupId')
          .lean()
          .exec()
      : [];
    const sourceQuestions = new Map(questions.map((q) => [String(q._id), q]));
    const groupIds = [
      ...new Set(
        listening.flatMap((q) => {
          const groupId =
            q.passageGroupId || sourceQuestions.get(q._id)?.passageGroupId;
          return groupId ? [String(groupId)] : [];
        }),
      ),
    ];
    const passages = groupIds.length
      ? await this.passages
          .find({
            passageGroupId: {
              $in: groupIds.map((id) => this.objectId(id)),
            },
          })
          .select('_id passageGroupId audioUrl order')
          .sort({ order: 1, _id: 1 })
          .lean()
          .exec()
      : [];
    return {
      ...this.summary(attempt),
      questions: attempt.questionSnapshot.map((q) => {
        const result = publicQuestion(
          q,
          attempt.status === ToeicAttemptStatus.FINISHED,
        );
        const answer = (attempt.revealedAnswers ?? attempt.answers)?.[q._id];
        if (
          attempt.mode === ExamMode.PRACTICE &&
          attempt.status === ToeicAttemptStatus.IN_PROGRESS &&
          answer
        ) {
          const { correct: _correct, ...feedback } = answerFeedback(q, answer);
          Object.assign(result, feedback);
        }
        if (q.part > 4) return result;
        const sourceQuestion = sourceQuestions.get(q._id);
        result.audioUrl = sourceQuestion?.audioUrl || q.audioUrl;
        const groupId =
          q.passageGroupId || sourceQuestion?.passageGroupId?.toString();
        result.passageGroupId = groupId;
        const group = passages.filter(
          (p) => String(p.passageGroupId) === groupId,
        );
        const snapshotPassages = q.passages ?? [];
        const matched = new Set<string>();
        result.passages = snapshotPassages.map((passage, index) => {
          // Old snapshots lack passage IDs; use their original sorted position
          // only while the group still has the same number of passages.
          const source = passage._id
            ? group.find((p) => String(p._id) === passage._id)
            : group.length === snapshotPassages.length
              ? group[index]
              : undefined;
          if (source) matched.add(String(source._id));
          return {
            ...result.passages[index],
            _id: passage._id || (source ? String(source._id) : undefined),
            audioUrl: source?.audioUrl || passage.audioUrl,
          };
        });
        // A legacy snapshot can contain no passages (or only empty objects).
        // Audio belongs to the live Passage, reached through passageGroupId;
        // it must not disappear just because it was absent from that snapshot.
        for (const passage of group) {
          if (passage.audioUrl && !matched.has(String(passage._id))) {
            result.passages.push({
              _id: String(passage._id),
              audioUrl: passage.audioUrl,
              content: undefined,
              imageUrl: undefined,
            });
          }
        }
        return result;
      }),
    };
  }

  async playAudio(userId: string, id: string, dto: AudioPlayDto) {
    const attempt = await this.findOne(userId, id);
    this.inProgress(attempt);
    const question = (
      attempt.questions as ReturnType<typeof publicQuestion>[]
    ).find((q) => q._id === dto.questionId);
    if (
      !question ||
      question.part > 4 ||
      (dto.passageId !== undefined && dto.passageIndex !== undefined)
    )
      throw new BadRequestException('Invalid listening audio');
    const passage =
      dto.passageId !== undefined
        ? question.passages.find((p) => p._id === dto.passageId)
        : dto.passageIndex !== undefined
          ? question.passages[dto.passageIndex]
          : undefined;
    if (
      dto.passageId !== undefined || dto.passageIndex !== undefined
        ? !passage?.audioUrl
        : !question.audioUrl
    )
      throw new BadRequestException('Audio not available');
    const key = passage
      ? passage._id
        ? `passage_${passage._id}`
        : `group_${question.passageGroupId || question._id}_${dto.passageIndex}`
      : `question_${question._id}`;
    if (attempt.mode === ExamMode.PRACTICE)
      return { key, used: 0, limit: null };
    const path = `audioPlayCounts.${key}`;
    // The count is reserved atomically BEFORE starting/restarting playback.
    // The passage key is shared by all questions referring to that recording.
    const updated = await this.attempts
      .findOneAndUpdate(
        {
          _id: this.objectId(id),
          userId: this.objectId(userId),
          status: ToeicAttemptStatus.IN_PROGRESS,
          mode: ExamMode.TEST,
          $expr: { $lt: [{ $ifNull: [`$${path}`, 0] }, 2] },
        },
        [
          {
            $set: {
              audioPlayCounts: {
                $mergeObjects: [
                  { $ifNull: ['$audioPlayCounts', {}] },
                  { [key]: { $add: [{ $ifNull: [`$${path}`, 0] }, 1] } },
                ],
              },
            },
          },
        ],
        { updatePipeline: true, returnDocument: 'after' },
      )
      .select('audioPlayCounts')
      .lean()
      .exec();
    if (!updated)
      throw new ConflictException(
        'Audio limit reached or attempt is no longer in progress',
      );
    return { key, used: updated.audioPlayCounts[key], limit: 2 };
  }

  async saveAnswer(userId: string, id: string, dto: SaveAnswerDto) {
    const attempt = await this.owned(userId, id);
    this.inProgress(attempt);
    const question = attempt.questionSnapshot.find(
      (q) => q._id === dto.questionId,
    );
    if (!question || !question.options.some((o) => o.key === dto.answer))
      throw new BadRequestException('Invalid question or answer');
    const result = await this.attempts
      .updateOne(
        {
          _id: attempt._id,
          userId: attempt.userId,
          status: ToeicAttemptStatus.IN_PROGRESS,
          // Lock only answers whose feedback has been revealed. Legacy
          // PRACTICE attempts already exposed every previously saved answer.
          ...(attempt.mode === ExamMode.PRACTICE
            ? {
                [`revealedAnswers.${dto.questionId}`]: { $exists: false },
                ...(attempt.revealedAnswers == null
                  ? { [`answers.${dto.questionId}`]: { $exists: false } }
                  : {}),
              }
            : {}),
          // Refuse answers once a timed test is past its deadline.
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            {
              expiresAt: {
                $gt: new Date(Date.now() - TIME_LIMIT_GRACE_MS),
              },
            },
          ],
        },
        [
          {
            $set: {
              ...(attempt.mode === ExamMode.PRACTICE
                ? {
                    revealedAnswers: {
                      $ifNull: ['$revealedAnswers', { $ifNull: ['$answers', {}] }],
                    },
                  }
                : {}),
              answers: {
                $mergeObjects: [
                  { $ifNull: ['$answers', {}] },
                  { [dto.questionId]: dto.answer },
                ],
              },
            },
          },
        ],
        { updatePipeline: true },
      )
      .exec();
    if (!result.matchedCount)
      throw new ConflictException(
        attempt.mode === ExamMode.PRACTICE
          ? 'This answer has already been revealed or the attempt is no longer in progress'
          : this.expired(attempt)
            ? 'Time is up for this attempt'
            : 'Attempt is no longer in progress',
      );
    return { saved: true };
  }

  async update(userId: string, id: string, dto: UpdateAttemptDto) {
    const attempt = await this.owned(userId, id);
    this.inProgress(attempt);
    const patch: Record<string, unknown> = {};
    if (dto.flaggedQuestions !== undefined) {
      if (
        !Array.isArray(dto.flaggedQuestions) ||
        dto.flaggedQuestions.some(
          (id) => !attempt.questionSnapshot.some((q) => q._id === id),
        )
      )
        throw new BadRequestException('Invalid flagged question');
      patch.flaggedQuestions = [...new Set(dto.flaggedQuestions)];
    }
    if (dto.currentQuestionIndex !== undefined) {
      if (
        !Number.isInteger(dto.currentQuestionIndex) ||
        dto.currentQuestionIndex < 0 ||
        dto.currentQuestionIndex >= attempt.totalQuestions
      )
        throw new BadRequestException('Invalid question index');
      patch.currentQuestionIndex = dto.currentQuestionIndex;
    }
    const result = await this.attempts
      .updateOne(
        { _id: attempt._id, status: ToeicAttemptStatus.IN_PROGRESS },
        { $set: patch },
      )
      .exec();
    if (!result.matchedCount)
      throw new ConflictException('Attempt is no longer in progress');
    return { saved: true };
  }

  async checkAnswer(userId: string, id: string, questionId: string) {
    const attempt = await this.owned(userId, id);
    this.inProgress(attempt);
    if (attempt.mode !== ExamMode.PRACTICE)
      throw new ForbiddenException(
        'Answer checking is not available in TEST mode',
      );
    const question = attempt.questionSnapshot.find((q) => q._id === questionId);
    if (!question || !attempt.answers?.[questionId])
      throw new BadRequestException('Save an answer for this question first');
    // Old clients already saw this key on save. Keep their answer locked.
    const existing = (attempt.revealedAnswers ?? attempt.answers)?.[questionId];
    if (existing)
      return { ...answerFeedback(question, existing), selectedAnswer: existing };
    // Read and freeze the answer in the same atomic operation: another tab's
    // save either wins before this reveal or is refused after it.
    const updated = await this.attempts.findOneAndUpdate(
      {
        _id: attempt._id,
        userId: attempt.userId,
        mode: ExamMode.PRACTICE,
        status: ToeicAttemptStatus.IN_PROGRESS,
        [`answers.${questionId}`]: { $exists: true },
      },
      [{ $set: {
        revealedAnswers: { $mergeObjects: [
          { $ifNull: ['$revealedAnswers', {}] },
          { [questionId]: `$answers.${questionId}` },
        ] },
      } }],
      { updatePipeline: true, returnDocument: 'after' },
    ).select('revealedAnswers').lean().exec();
    if (!updated) throw new ConflictException('Attempt is no longer in progress');
    const selectedAnswer = updated.revealedAnswers![questionId];
    return { ...answerFeedback(question, selectedAnswer), selectedAnswer };
  }

  async submit(userId: string, id: string) {
    const attempt = await this.owned(userId, id);
    if (attempt.status === ToeicAttemptStatus.FINISHED)
      return this.findOne(userId, id);
    this.inProgress(attempt);
    await this.grade(attempt);
    return this.findOne(userId, id);
  }

  async abandon(userId: string, id: string) {
    const attempt = await this.owned(userId, id);
    this.inProgress(attempt);
    const result = await this.attempts
      .updateOne(
        { _id: attempt._id, status: ToeicAttemptStatus.IN_PROGRESS },
        {
          $set: {
            status: ToeicAttemptStatus.ABANDONED,
            completedAt: new Date(),
          },
        },
      )
      .exec();
    if (!result.matchedCount)
      throw new ConflictException('Attempt is no longer in progress');
    return this.summary({ ...attempt, status: ToeicAttemptStatus.ABANDONED });
  }
}
