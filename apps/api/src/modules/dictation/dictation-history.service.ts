import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  InjectPgConnection,
  withPgTransaction,
  type PgConnection,
} from '../../postgres/connection.js';
import { isUuid } from '../../postgres/ids.js';
import { resolveExamNames } from '../assessment/exams/community/exam-profile-names.js';
import { DictationHistoryQueryDto } from './dto/dictation-history.dto.js';
type Action = {
  type: 'ATTEMPT' | 'REPLAY' | 'REVEAL_SEGMENT' | 'REVEAL_TRANSCRIPT' | 'RESET';
  segmentIndex?: number;
  isCorrect?: boolean;
  submittedText?: string;
  eventId?: string;
};
@Injectable()
export class DictationHistoryService {
  constructor(@InjectPgConnection() private readonly db: PgConnection) {}
  private async lesson(id: string) {
    if (!isUuid(id)) throw new BadRequestException('Invalid lesson ID');
    const { rows } = await this.db.query(
      'SELECT id,sentence_count,publication_revision FROM dictationlessons WHERE id=$1 AND is_deleted IS NOT TRUE',
      [id],
    );
    if (!rows.length) throw new NotFoundException('Dictation lesson not found');
    return rows[0];
  }
  /** Progress mutation, durable action and session share the same owner transaction. */
  async track<T extends Record<string, any>>(
    userId: string,
    lessonId: string,
    action: Action,
    work: () => Promise<T>,
  ): Promise<T> {
    if (!isUuid(userId) || !isUuid(lessonId))
      throw new BadRequestException('Invalid user or lesson');
    const eventId = action.eventId ?? randomUUID();
    const hash = createHash('sha256')
      .update(
        JSON.stringify([
          userId,
          lessonId,
          action.type,
          action.segmentIndex ?? null,
          action.isCorrect ?? null,
          action.submittedText ?? null,
        ]),
      )
      .digest('hex');
    return withPgTransaction(this.db, async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `dictation-learning:${userId}:${lessonId}`,
      ]);
      const previous = await tx.query(
        'SELECT request_hash,result FROM dictation_learning_events WHERE id=$1',
        [eventId],
      );
      if (previous.rows.length) {
        if (previous.rows[0].request_hash !== hash)
          throw new BadRequestException(
            'Event ID already used for another action',
          );
        return previous.rows[0].result as T;
      }
      const lesson = await this.lesson(lessonId);
      const now: string = (
        await tx.query('SELECT clock_timestamp()::text AS time')
      ).rows[0].time;
      const found = await tx.query(
        `SELECT * FROM dictation_learning_sessions WHERE user_id=$1 AND lesson_id=$2 ORDER BY last_activity_at DESC,id DESC LIMIT 1 FOR UPDATE`,
        [userId, lessonId],
      );
      let session = found.rows[0];
      if (
        session &&
        (session.ended_at ||
          new Date(now).getTime() -
            new Date(session.last_activity_at).getTime() >
            30 * 60000 ||
          session.lesson_revision !== lesson.publication_revision)
      ) {
        await tx.query(
          'UPDATE dictation_learning_sessions SET ended_at=coalesce(ended_at,last_activity_at) WHERE id=$1',
          [session.id],
        );
        session = undefined;
      }
      let reference: string | null = null;
      if (action.segmentIndex !== undefined) {
        const segment = await tx.query(
          'SELECT text FROM dictationsegments WHERE lesson_id=$1 ORDER BY "order",id OFFSET $2 LIMIT 1',
          [lessonId, action.segmentIndex],
        );
        if (!segment.rows.length)
          throw new BadRequestException('Invalid dictation sentence index');
        reference = segment.rows[0].text;
      }
      const baseline = (
        await tx.query(
          'SELECT completed FROM dictationprogresses WHERE user_id=$1 AND lesson_id=$2',
          [userId, lessonId],
        )
      ).rows[0];
      const result = await work();
      // Reset ends the current session but does not turn an untouched lesson into a practice session.
      if (!session && action.type === 'RESET') return result;
      if (!session)
        session = (
          await tx.query(
            `INSERT INTO dictation_learning_sessions(user_id,lesson_id,started_at,last_activity_at,lesson_revision,sentence_count) VALUES($1,$2,$3,$3,$4,$5) RETURNING *`,
            [
              userId,
              lessonId,
              now,
              lesson.publication_revision,
              lesson.sentence_count,
            ],
          )
        ).rows[0];
      await tx.query(
        `INSERT INTO dictation_learning_events(id,session_id,action,segment_index,submitted_text,reference_text,is_correct,occurred_at,request_hash,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [
          eventId,
          session.id,
          action.type,
          action.segmentIndex ?? null,
          action.submittedText ?? null,
          reference,
          action.isCorrect ?? null,
          now,
          hash,
          JSON.stringify(result),
        ],
      );
      const handled = Number(
        (
          await tx.query(
            "SELECT count(DISTINCT segment_index) n FROM dictation_learning_events WHERE session_id=$1 AND (is_correct IS TRUE OR action='REVEAL_SEGMENT')",
            [session.id],
          )
        ).rows[0].n,
      );
      const complete =
        (action.type === 'ATTEMPT' || action.type === 'REVEAL_SEGMENT') &&
        ((result.completed === true && baseline?.completed !== true) ||
          handled >= session.sentence_count);
      await tx.query(
        'UPDATE dictation_learning_sessions SET last_activity_at=$2,completed=completed OR $3,ended_at=CASE WHEN $4 THEN $2 ELSE ended_at END WHERE id=$1',
        [session.id, now, complete, action.type === 'RESET'],
      );
      return result;
    });
  }
  async learners(lessonId: string, q: DictationHistoryQueryDto) {
    const lesson = await this.lesson(lessonId),
      args = [lessonId, q.userId ?? null, q.status];
    const filter = `lesson_id=$1 AND ($2::uuid IS NULL OR user_id=$2) AND ($3='all' OR completed=($3='completed'))`;
    const [result, total, summary] = await Promise.all([
      this.db.query(
        `SELECT id,user_id,completed,completed_segments,revealed_segments,segment_progress,correct_count,wrong_count,attempts,last_practiced_at FROM dictationprogresses WHERE ${filter} ORDER BY last_practiced_at DESC NULLS LAST,id LIMIT $4 OFFSET $5`,
        [...args, q.limit, (q.page - 1) * q.limit],
      ),
      this.db.query(
        `SELECT count(*)::int total FROM dictationprogresses WHERE ${filter}`,
        args,
      ),
      this.db.query(
        `SELECT count(*)::int learners,count(*) FILTER(WHERE completed IS TRUE)::int completed,coalesce(sum(correct_count),0)::int correct,coalesce(sum(attempts),0)::int attempts,(SELECT count(*)::int FROM dictation_learning_sessions WHERE lesson_id=$1) sessions FROM dictationprogresses WHERE lesson_id=$1`,
        [lessonId],
      ),
    ]);
    const names = await resolveExamNames(result.rows.map((r) => r.user_id));
    return {
      items: result.rows.map((r) => ({
        ...r,
        username: names[r.user_id] ?? null,
        sentence_count: lesson.sentence_count,
      })),
      total: total.rows[0].total,
      page: q.page,
      limit: q.limit,
      summary: summary.rows[0],
    };
  }
  async sessions(lessonId: string, q: DictationHistoryQueryDto) {
    await this.lesson(lessonId);
    const args = [lessonId, q.userId ?? null, q.status];
    const filter = `s.lesson_id=$1 AND ($2::uuid IS NULL OR s.user_id=$2) AND ($3='all' OR s.completed=($3='completed'))`;
    const [result, total] = await Promise.all([
      this.db.query(
        `SELECT s.*,coalesce(e.attempts,0)::int attempts,coalesce(e.correct,0)::int correct,coalesce(e.replays,0)::int replays,coalesce(e.reveals,0)::int reveals,
        extract(epoch FROM (s.last_activity_at-s.started_at))::int duration_sec,
        CASE WHEN s.completed THEN 'COMPLETED' WHEN s.ended_at IS NOT NULL OR s.last_activity_at<now()-interval '30 minutes' THEN 'ENDED' ELSE 'ACTIVE' END status
        FROM dictation_learning_sessions s LEFT JOIN LATERAL(SELECT count(*) FILTER(WHERE action='ATTEMPT') attempts,count(*) FILTER(WHERE is_correct IS TRUE) correct,count(*) FILTER(WHERE action='REPLAY') replays,count(*) FILTER(WHERE action IN ('REVEAL_SEGMENT','REVEAL_TRANSCRIPT')) reveals FROM dictation_learning_events WHERE session_id=s.id)e ON true
        WHERE ${filter} ORDER BY s.last_activity_at DESC,s.id LIMIT $4 OFFSET $5`,
        [...args, q.limit, (q.page - 1) * q.limit],
      ),
      this.db.query(
        `SELECT count(*)::int total FROM dictation_learning_sessions s WHERE ${filter}`,
        args,
      ),
    ]);
    const names = await resolveExamNames(result.rows.map((r) => r.user_id));
    return {
      items: result.rows.map((r) => ({
        ...r,
        username: names[r.user_id] ?? null,
      })),
      total: total.rows[0].total,
      page: q.page,
      limit: q.limit,
    };
  }
  async events(
    lessonId: string,
    sessionId: string,
    q: DictationHistoryQueryDto,
  ) {
    await this.lesson(lessonId);
    if (!isUuid(sessionId)) throw new BadRequestException('Invalid session ID');
    const found = await this.db.query(
      'SELECT * FROM dictation_learning_sessions WHERE id=$1 AND lesson_id=$2',
      [sessionId, lessonId],
    );
    if (!found.rows.length)
      throw new NotFoundException('Practice session not found');
    const [result, total] = await Promise.all([
      this.db.query(
        'SELECT id,action,segment_index,submitted_text,reference_text,is_correct,occurred_at FROM dictation_learning_events WHERE session_id=$1 ORDER BY occurred_at,id LIMIT $2 OFFSET $3',
        [sessionId, q.limit, (q.page - 1) * q.limit],
      ),
      this.db.query(
        'SELECT count(*)::int total FROM dictation_learning_events WHERE session_id=$1',
        [sessionId],
      ),
    ]);
    return {
      session: found.rows[0],
      items: result.rows,
      total: total.rows[0].total,
      page: q.page,
      limit: q.limit,
    };
  }
}
