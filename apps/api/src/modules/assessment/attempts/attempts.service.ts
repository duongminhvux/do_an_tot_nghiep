import {
BadRequestException,
ConflictException,
ForbiddenException,
Inject,
Injectable,
NotFoundException,
Optional
} from '@nestjs/common';
import { toeicAttemptXp } from '@repo/shared-types/learning-xp';
import { toeicOutcomes } from '@repo/shared-types/mistakes';
import { LearningActivityClient } from '../../../common/clients/learning-activity-client.js';
import { DomainOutboxService } from '../../../common/events/domain-outbox.service.js';
import { createConnection,InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { isUuid } from '../../../postgres/ids.js';
import { SqlRecords } from '../../../postgres/records.js';
import { rows,sql,type Sql } from '../../../postgres/sql.js';
import type { LearningActivityWriter } from '../../learning-activity/learning-activity.service.js';
import { attemptOverview,attemptStatistics } from './attempt-stats.sql.js';

import {
estimateToeicScore,
TOEIC_SCORE_BANDS,
TOEIC_TOTAL_MAX,
toeicScoreBand
} from '@repo/shared-types/toeic-score';
import type { SqlRow } from '../../../postgres/row.js';
import { Exam } from '../exams/rows/exam.row.js';
import { Passage } from '../questions/rows/passage.row.js';
import { Question } from '../questions/rows/question.row.js';
import {
calculateAttemptResult,
COMPLETED_STATUSES
} from './attempt-results.js';
import type { SnapshotQuestion } from './attempt.types.js';
import { ExamMode,ToeicAttemptStatus } from './attempt.types.js';
import { CreateAttemptDto } from './dto/create-attempt.dto.js';
import type {
AdminQueryAttemptDto,
QueryAttemptDto
} from './dto/query-attempt.dto.js';
import {
AudioPlayDto,
SaveAnswerDto,
UpdateAttemptDto
} from './dto/update-attempt.dto.js';
import { Attempt } from './rows/attempt.row.js';

export function publicQuestion(question: SnapshotQuestion, review = false) {
  const {
    _id,
    part,
    content,
    options,
    imageUrl,
    audioUrl,
    passageGroupId,
    passages = [] } = question;
  return {
    _id,
    part,
    // Part 1/2 content and option text contain the spoken script, not a
    // printed question. Never include that script in an unfinished attempt.
    content: part <= 2 && !review ? '' : content,
    options: options.map(({ key, text }) => ({
      key,
      text: part <= 2 && !review ? '' : text })),
    imageUrl,
    audioUrl,
    passageGroupId,
    passages: passages.map(({ _id, content, imageUrl, audioUrl }) => ({
      _id,
      content: part <= 4 && !review ? undefined : content,
      imageUrl,
      audioUrl })),
    ...(review
      ? {
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          transcript: question.transcript || (part <= 2 ? content : undefined) }
      : {}) };
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
      (question.part <= 2 ? question.content : undefined) };
}

@Injectable()
export class AttemptsService {
  private get attempts(){return new SqlRecords<SqlRow<Attempt>>(this.nativeDb,'attempts');}
private get exams(){return new SqlRecords<SqlRow<Exam>>(this.nativeDb,'exams');}
private get questions(){return new SqlRecords<SqlRow<Question>>(this.nativeDb,'questions');}
private get passages(){return new SqlRecords<SqlRow<Passage>>(this.nativeDb,'passages');}
constructor(
@InjectPgConnection() private readonly nativeDb:PgConnection,@Optional()
    @Inject(LearningActivityClient) private readonly learningActivity?: LearningActivityWriter,
@Optional() @Inject(DomainOutboxService) private readonly domainOutbox?: DomainOutboxService
  ) {}

  async availableParts(idOrSlug: string) {
    const exam=await this.exams.one(sql`type='TOEIC' AND publication_status='PUBLISHED' AND is_deleted IS NOT TRUE AND is_active IS NOT FALSE AND ${isUuid(idOrSlug)?sql`id=${idOrSlug}::uuid`:sql`slug=${idOrSlug}`}`);
    if (!exam) throw new NotFoundException('Exam not found');
    const parts=await rows(this.nativeDb,sql`SELECT part AS "_id",COUNT(*)::int AS "totalQuestions" FROM questions WHERE exam_id=${exam._id}::uuid AND is_active IS NOT FALSE GROUP BY part ORDER BY part`);
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
    return parts.map((row) => ({
      _id: String(row._id),
      part: row._id,
      section: row._id <= 4 ? 'LISTENING' : 'READING',
      type: names[row._id],
      totalQuestions: row.totalQuestions }));
  }

  private async hydrateAttempts(pending:Promise<any[]>,includeUser=false){
    const list=await pending;const exams=await this.exams.select(sql`id=ANY(${list.map(row=>row.examId)}::uuid[])`);const map=new Map(exams.map(row=>[String(row._id),{_id:String(row._id),name:row.name,slug:row.slug}]));
    const users=includeUser?await new SqlRecords(this.nativeDb,'identity_profiles').select(sql`id=ANY(${list.map(row=>row.userId)}::uuid[])`):[];const userMap=new Map(users.map(row=>[String(row._id),{_id:String(row._id),username:row.username}]));
    return list.map(row=>({...row,examId:map.get(String(row.examId))??null,...(includeUser?{userId:userMap.get(String(row.userId))??null}:{})}));
  }
  private uuid(id: string) {
    if (!isUuid(id))
      throw new BadRequestException('Invalid id');
    return String(id);
  }

  private async owned(userId: string, id: string) {
    const attempt = await this.attempts.one(sql`("id" = ${this.uuid(id)}) AND ("user_id" = ${this.uuid(userId)})`);
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
      readingScore: scaled?.reading ?? undefined };
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
    const exam=await this.exams.one(sql`id=${this.uuid(dto.examId)}::uuid AND type='TOEIC' AND publication_status='PUBLISHED' AND is_deleted IS NOT TRUE AND is_active IS NOT FALSE`);
    if (!exam) throw new NotFoundException('Exam not found');
    const questions = await this.questions.select(sql`("exam_id" = ${exam._id}) AND ("is_active" IS DISTINCT FROM ${false}) AND ("part"=ANY(${dto.selectedParts}::double precision[]))`, sql`ORDER BY "part" ASC NULLS FIRST,"order" ASC NULLS FIRST,"source_order" ASC NULLS FIRST,"id" ASC NULLS FIRST`);
    if (dto.selectedParts.some((p) => !questions.some((q) => q.part === p)))
      throw new BadRequestException('Part is not available in this exam');
    const groupIds = questions.flatMap((q) =>
      q.passageGroupId ? [q.passageGroupId] : [],
    );
    const passages = await this.passages.select(sql`("passage_group_id"=ANY(${groupIds}::uuid[]))`, sql`ORDER BY "order" ASC NULLS FIRST,"id" ASC NULLS FIRST`);
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
          audioUrl: p.audioUrl })),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        transcript: [
          transcript(q.audioMeta) || (q.part <= 2 ? q.content : ''),
          ...group.map(
            (p) => transcript(p.audioMeta) || (q.part <= 4 ? p.content : ''),
          ),
        ]
          .filter(Boolean)
          .join('\n') };
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
    let attempt;
    try { attempt = await this.attempts.insert({
      examPublicationRevision:exam.publicationRevision,
      userId: this.uuid(userId),
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
      totalQuestions: questions.length });
    } catch(error) {
      if((error as Error).message?.includes('Exam publication changed'))throw new ConflictException('Exam content changed; choose a published exam and try again');
      throw error;
    }
    return { _id: String(attempt._id) };
  }

  private async listFilter(
    userId: string | undefined,
    query: AdminQueryAttemptDto,
  ) {
    const user=userId||query.userId;
    let exam:string|undefined;
    if(query.examId){const match=await this.exams.one(isUuid(query.examId)?sql`id=${query.examId}::uuid`:sql`slug=${query.examId}`);if(!match)return sql`FALSE`;exam=String(match._id);}
    return sql`(${user??null}::uuid IS NULL OR user_id=${user?this.uuid(user):null}::uuid)
      AND (${exam??null}::uuid IS NULL OR exam_id=${exam??null}::uuid)
      AND (${query.mode??null}::text IS NULL OR mode=${query.mode??null})
      AND (${query.status??null}::text IS NULL OR ${query.status==='FINISHED'} AND status IN ('FINISHED','COMPLETED') OR status=${query.status??null})`;
  
  }

  async findAll(userId: string, queryOrExam: QueryAttemptDto | string = {}) {
    const query =
      typeof queryOrExam === 'string' ? { examId: queryOrExam } : queryOrExam;
    const filter = await this.listFilter(userId, query);
    const limit = Math.max(1, Math.min(100, query.limit ?? 100));
    const rows=await this.hydrateAttempts(this.attempts.select(filter,sql`ORDER BY ${query.sort==='oldest'?sql`created_at ASC,id ASC`:sql`created_at DESC,id DESC`} LIMIT ${limit} OFFSET ${((query.page??1)-1)*limit}`));
    return rows.map((row) => this.summary(row));
  }

  async adminList(query: AdminQueryAttemptDto = {}) {
    const filter = await this.listFilter(undefined, query);
    const page = query.page ?? 1;
    const limit = Math.max(1, Math.min(100, query.limit ?? 100));
    const [rows, total] = await Promise.all([
      this.hydrateAttempts(this.attempts.select(filter,sql`ORDER BY created_at DESC,id DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`),true),
      this.attempts.count(filter),
    ]);
    return { data: rows.map((row) => this.summary(row)), total, page, limit };
  }

  async adminFindOne(id: string) {
    const attempt=(await this.hydrateAttempts(this.attempts.select(sql`id=${this.uuid(id)}::uuid`),true))[0];
    if (!attempt) throw new NotFoundException('Attempt not found');
    return {
      ...this.summary(attempt),
      hasSnapshot: Boolean(attempt.questionSnapshot?.length),
      questions:
        attempt.questionSnapshot?.map((q:SnapshotQuestion) => publicQuestion(q, true)) ?? [] };
  }

  async stats(userId?: string, query: AdminQueryAttemptDto = {}) {
    const baseFilter = await this.listFilter(userId, query);
    const dayMs = 24 * 60 * 60 * 1000;
    const since = query.days
      ? new Date(Date.now() - query.days * dayMs)
      : undefined;
    const filter=sql`${baseFilter} ${since?sql`AND created_at>=${since}`:sql``}`;
    const timezone=query.timezone||'UTC';
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
        : 0 });
    const previousWhere=since?sql`${baseFilter} AND created_at>=${new Date(since.getTime()-query.days!*dayMs)} AND created_at<${since}`:sql`FALSE`;
    const scoredWhere=(where:Sql)=>sql`${where} AND mode='TEST' AND status IN ('FINISHED','COMPLETED') AND ${query.mode!==ExamMode.PRACTICE}`;
    const [result,recent,previous,scoredRows,previousScoredRows]=await Promise.all([
      attemptStatistics(this.nativeDb,filter,timezone),
      this.hydrateAttempts(this.attempts.select(filter,sql`ORDER BY created_at DESC,id DESC LIMIT 5`)),
      since?attemptOverview(this.nativeDb,previousWhere).then(row=>[row]):Promise.resolve(null),
      this.attempts.select(scoredWhere(filter)),
      since?this.attempts.select(scoredWhere(previousWhere)):Promise.resolve([]),
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
        : 0 }));
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
        accuracy: total ? Math.round((correct / total) * 10000) / 100 : 0 };
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
        fullTest: row.selectedParts?.length === 7 }));
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
        ) };
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
            ...scoreSummary(scoredOf(previousScoredRows)) }
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
        avgReadingScore: scoresOn(day._id).avgReadingScore })),
      scoreDistribution: TOEIC_SCORE_BANDS.map(({ band }) => ({
        band,
        count: scored.filter(
          (r) =>
            r.fullTest &&
            r.score?.max === TOEIC_TOTAL_MAX &&
            toeicScoreBand(r.score.total) === band,
        ).length })),
      distribution: ['excellent', 'good', 'fair', 'average', 'low'].map(
        (band) => ({
          band,
          count: distributionRows.find((row) => row._id === band)?.count ?? 0 }),
      ),
      resultType: 'RAW',
      recentAttempts: recent.map((row) => this.summary(row)) };
  }

  private expired(attempt: Attempt) {
    return Boolean(
      attempt.status === ToeicAttemptStatus.IN_PROGRESS &&
      attempt.expiresAt &&
      new Date(attempt.expiresAt).getTime() + TIME_LIMIT_GRACE_MS < Date.now(),
    );
  }

  private async grade(attempt: Attempt & { _id: string }) {
    if (!this.domainOutbox) throw new Error('Transactional outbox is required for TOEIC grading');
    await this.domainOutbox.withTransaction(async (session) => {
      const records=new SqlRecords(createConnection(session.client as any),'attempts');
      const current=await records.one(sql`id=${attempt._id}::uuid`,sql`FOR UPDATE`);
      if(!current||current.status!==ToeicAttemptStatus.IN_PROGRESS)return;
      const result=calculateAttemptResult(current.questionSnapshot,current.selectedParts,current.answers??{},current.startedAt);
      const graded=await records.patch(sql`id=${attempt._id}::uuid AND status='IN_PROGRESS'`,result);
      if(!graded)return;
      const correct = graded.correctAnswers ?? 0;
      await this.domainOutbox!.enqueue('learning.activity.recorded.v1', String(graded.userId), {
        userId: String(graded.userId),
        module: 'TOEIC',
        type: 'TOEIC_ATTEMPT',
        sourceKey: `toeic:${attempt._id}`,
        xp: toeicAttemptXp(correct),
        occurredAt: graded.submittedAt ?? new Date(),
        title: graded.examSnapshot?.name,
        refId: String(attempt._id),
        link: `/toeic/attempts/${attempt._id}/result`,
        correct,
        total: graded.totalQuestions,
        score: this.summary(graded).score,
        durationSec: graded.durationSpent,
        metadata: { mode: graded.mode, selectedParts: graded.selectedParts },
        sourceService: 'assessment',
        outcomes: toeicOutcomes({ ...graded, questionSnapshot: attempt.questionSnapshot }),
      }, session);
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
      ? await this.questions.select(sql`("id"=ANY(${listening.map((q) => this.uuid(q._id))}::uuid[])) AND ("exam_id" = ${attempt.examId})`)
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
      ? await this.passages.select(sql`("passage_group_id"=ANY(${groupIds.map((id) => this.uuid(id))}::uuid[]))`, sql`ORDER BY "order" ASC NULLS FIRST,"id" ASC NULLS FIRST`)
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
            audioUrl: source?.audioUrl || passage.audioUrl };
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
              imageUrl: undefined });
          }
        }
        return result;
      }) };
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
    const updated=await this.attempts.patch(sql`id=${this.uuid(id)}::uuid AND user_id=${this.uuid(userId)}::uuid AND status='IN_PROGRESS' AND mode='TEST' AND COALESCE((audio_play_counts->>${key})::int,0)<2`,{},
      {audioPlayCounts:sql`COALESCE(audio_play_counts,'{}')||jsonb_build_object(${key}::text,COALESCE((audio_play_counts->>${key})::int,0)+1)`});
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
    const result=await this.attempts.patch(sql`id=${attempt._id}::uuid AND user_id=${attempt.userId}::uuid AND status='IN_PROGRESS'
      AND (mode<>'PRACTICE' OR NOT (COALESCE(revealed_answers,answers,'{}') ? ${dto.questionId}))
      AND (expires_at IS NULL OR expires_at>${new Date(Date.now()-TIME_LIMIT_GRACE_MS)})`,{},
      {answers:sql`COALESCE(answers,'{}')||jsonb_build_object(${dto.questionId}::text,${dto.answer}::text)`,
       ...(attempt.mode===ExamMode.PRACTICE?{revealedAnswers:sql`COALESCE(revealed_answers,answers,'{}')`}:{}),});
    if (!result) {
      const latest = await this.owned(userId, id);
      throw new ConflictException(
        latest.answers?.[dto.questionId]
          ? 'This question has already been answered'
          : this.expired(latest)
            ? 'Time is up for this attempt'
            : 'Attempt is no longer in progress',
      );
    }
    return attempt.mode === ExamMode.PRACTICE
      ? { saved: true, feedback: answerFeedback(question, dto.answer) }
      : { saved: true };
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
    const result=await this.attempts.patch(sql`id=${attempt._id}::uuid AND status='IN_PROGRESS'`,patch);
    if (!result)
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
    const updated=await this.attempts.patch(sql`id=${attempt._id}::uuid AND user_id=${attempt.userId}::uuid AND mode='PRACTICE' AND status='IN_PROGRESS' AND answers ? ${questionId}`,{},
      {revealedAnswers:sql`COALESCE(revealed_answers,'{}')||jsonb_build_object(${questionId}::text,answers->${questionId})`});
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
    const result=await this.attempts.patch(sql`id=${attempt._id}::uuid AND status='IN_PROGRESS'`,{status:ToeicAttemptStatus.ABANDONED,completedAt:new Date()});
    if (!result)
      throw new ConflictException('Attempt is no longer in progress');
    return this.summary({ ...attempt, status: ToeicAttemptStatus.ABANDONED });
  }
}
