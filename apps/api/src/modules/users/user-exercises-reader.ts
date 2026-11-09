import { BadRequestException, NotFoundException } from '@nestjs/common';
import { estimateToeicScore } from '@repo/shared-types/toeic-score';
import type { PgConnection } from '../../postgres/connection.js';
import { isUuid } from '../../postgres/ids.js';
import { contentRows } from '../vocabulary/content-reader.js';
import {
  EXERCISE_OWNERS,
  type ExerciseModule,
  UserExercisesReadDto,
} from './dto/user-exercises.dto.js';
export interface ExerciseRecord {
  id: string;
  module: ExerciseModule;
  title: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationSec: number | null;
  correct: number | null;
  total: number | null;
  score: number | null;
  scoreMax: number | null;
  metadata: Record<string, any>;
}
export interface ExerciseRow {
  id: string;
  index: number;
  prompt: string;
  submitted: string | null;
  expected: string | null;
  correct: boolean | null;
  occurredAt: string | null;
  metadata?: Record<string, any>;
}
const date = (value: any) => (value ? new Date(value).toISOString() : null);
function validate(owner: string, q: UserExercisesReadDto) {
  if (
    !q ||
    !isUuid(q.userId) ||
    !Object.hasOwn(EXERCISE_OWNERS, q.module) ||
    EXERCISE_OWNERS[q.module] !== owner
  )
    throw new BadRequestException('Invalid exercise owner or learner');
  if (
    !Number.isInteger(q.page) ||
    q.page < 1 ||
    q.page > 100000 ||
    !Number.isInteger(q.limit) ||
    q.limit < 1 ||
    q.limit > 50 ||
    !['all', 'completed', 'unfinished'].includes(q.status)
  )
    throw new BadRequestException('Invalid exercise page');
  if (
    (q.from && !Number.isFinite(Date.parse(q.from))) ||
    (q.to && !Number.isFinite(Date.parse(q.to))) ||
    (q.from && q.to && Date.parse(q.from) >= Date.parse(q.to))
  )
    throw new BadRequestException('Invalid exercise date range');
  if (q.recordId && !isUuid(q.recordId))
    throw new BadRequestException('Invalid exercise ID');
}
const sources = {
  toeic: {
    from: 'attempts a LEFT JOIN exams e ON e.id=a.exam_id',
    user: 'a.user_id',
    id: 'a.id',
    time: 'a.started_at',
    done: "a.status IN ('FINISHED','COMPLETED')",
    fields: "a.*,coalesce(e.name,a.exam_snapshot->>'name','TOEIC') AS title",
  },
  vocabulary: {
    from: 'learningsessions a',
    user: 'a.user_id',
    id: 'a.id',
    time: 'a.started_at',
    done: 'a.ended_at IS NOT NULL',
    fields:
      'a.*,(SELECT count(*)::int FROM learningsessionwords w WHERE w.session_id=a.id AND w.is_correct IS NOT NULL) answers_total,(SELECT count(*)::int FROM learningsessionwords w WHERE w.session_id=a.id AND w.is_correct IS TRUE) answers_correct',
  },
  dictation: {
    from: 'dictation_learning_sessions a JOIN dictationlessons l ON l.id=a.lesson_id',
    user: 'a.user_id',
    id: 'a.id',
    time: 'a.started_at',
    done: 'a.completed IS TRUE',
    fields:
      "a.*,l.title,(SELECT count(*)::int FROM dictation_learning_events e WHERE e.session_id=a.id AND e.action='ATTEMPT') answers_total,(SELECT count(*)::int FROM dictation_learning_events e WHERE e.session_id=a.id AND e.is_correct IS TRUE) answers_correct",
  },
  arena: {
    from: 'arenamatchplayers p JOIN arenamatches a ON a.id=p.match_id',
    user: 'p.user_id',
    id: 'a.id',
    time: 'coalesce(a.started_at,a.created_at)',
    done: "a.status='FINISHED'",
    fields:
      'a.*,p.score AS self_score,p.correct_answers AS self_correct,p.rating_before,p.rating_after,p.rating_change,p.user_id AS self_id',
  },
  minigame: {
    from: 'minigameresults a',
    user: 'a.user_id',
    id: 'a.id',
    time: 'a.created_at',
    done: 'true',
    fields: 'a.*',
  },
} as const;
function shape(module: ExerciseModule, r: any): ExerciseRecord {
  const completed = ['FINISHED', 'COMPLETED'].includes(r.status);
  const score =
    module === 'toeic' && completed && r.mode === 'TEST'
      ? estimateToeicScore(r.listening_result, r.reading_result)
      : null;
  const base: ExerciseRecord = {
    id: r.id,
    module,
    title: r.title ?? '',
    status: r.status ?? 'FINISHED',
    startedAt: date(r.started_at ?? r.created_at)!,
    finishedAt: date(r.completed_at ?? r.finished_at ?? r.ended_at),
    durationSec: r.duration_spent ?? r.duration_seconds ?? null,
    correct: null,
    total: null,
    score: null,
    scoreMax: null,
    metadata: {},
  };
  if (module === 'toeic')
    return {
      ...base,
      correct: completed ? (r.correct_answers ?? r.total_correct) : null,
      total: r.total_questions,
      score: score?.total ?? null,
      scoreMax: score?.max ?? null,
      metadata: {
        mode: r.mode,
        answered: r.answered_questions,
        accuracy: r.accuracy,
      },
    };
  if (module === 'vocabulary')
    return {
      ...base,
      title: r.title ?? 'Vocabulary',
      status: r.ended_at ? 'FINISHED' : 'IN_PROGRESS',
      correct: r.answers_correct,
      total: r.answers_total,
      metadata: {
        type: r.type,
        completedWords: r.completed_words,
        totalWords: r.total_words,
      },
    };
  if (module === 'dictation')
    return {
      ...base,
      status: r.completed
        ? 'COMPLETED'
        : r.ended_at || Date.parse(r.last_activity_at) < Date.now() - 1800000
          ? 'ENDED'
          : 'IN_PROGRESS',
      finishedAt: date(r.ended_at ?? (r.completed ? r.last_activity_at : null)),
      durationSec: Math.max(
        0,
        Math.round(
          (Date.parse(r.last_activity_at) - Date.parse(r.started_at)) / 1000,
        ),
      ),
      correct: r.answers_correct,
      total: r.answers_total,
      metadata: { lessonId: r.lesson_id, sentences: r.sentence_count },
    };
  if (module === 'arena')
    return {
      ...base,
      title: 'Arena',
      correct: r.self_correct,
      total: r.question_count,
      score: r.self_score,
      durationSec:
        r.started_at && r.finished_at
          ? Math.max(
              0,
              Math.round(
                (+new Date(r.finished_at) - +new Date(r.started_at)) / 1000,
              ),
            )
          : null,
      metadata: {
        type: r.type,
        result: r.is_draw
          ? 'DRAW'
          : r.winner_id === r.self_id
            ? 'WIN'
            : r.status === 'FINISHED'
              ? 'LOSS'
              : null,
        ratingChange: r.rating_change,
      },
    };
  return {
    ...base,
    title: r.game_type,
    status: 'FINISHED',
    finishedAt: date(r.created_at),
    score: r.score,
    metadata: { gameType: r.game_type, summaryOnly: true },
  };
}
async function sourceRows(
  db: PgConnection,
  q: UserExercisesReadDto,
  detail = false,
) {
  const s = sources[q.module],
    args: any[] = [q.userId, q.from ?? null, q.to ?? null, q.status];
  let where = `${s.user}=$1 AND ($2::timestamptz IS NULL OR ${s.time}>=$2) AND ($3::timestamptz IS NULL OR ${s.time}<$3) AND ($4='all' OR (${s.done})=($4='completed'))`;
  if (detail) {
    where += ` AND ${s.id}=$5`;
    args.push(q.recordId);
  }
  const pageArgs = detail ? args : [...args, q.limit, (q.page - 1) * q.limit];
  const result = await db.query(
    `SELECT ${s.fields} FROM ${s.from} WHERE ${where} ORDER BY ${s.time} DESC,${s.id} DESC ${detail ? 'LIMIT 1' : 'LIMIT $5 OFFSET $6'}`,
    pageArgs,
  );
  if (q.module === 'vocabulary' && result.rows.length) {
    const ids = [
      ...new Set<string>(result.rows.map((r) => r.lesson_id).filter(Boolean)),
    ];
    const lessons = ids.length
      ? await contentRows(db, 'lessons', {
          ids,
          includeDeleted: true,
          limit: 50,
        })
      : [];
    const names = new Map(lessons.map((l) => [l._id, l.title]));
    for (const r of result.rows)
      r.title = names.get(r.lesson_id) ?? 'Vocabulary';
  }
  return {
    rows: result.rows,
    total: detail
      ? result.rows.length
      : Number(
          (
            await db.query(
              `SELECT count(*)::int n FROM ${s.from} WHERE ${where}`,
              args,
            )
          ).rows[0].n,
        ),
  };
}
export async function readUserExercises(
  db: PgConnection,
  owner: string,
  q: UserExercisesReadDto,
) {
  validate(owner, q);
  const result = await sourceRows(db, q);
  return {
    items: result.rows.map((r) => shape(q.module, r)),
    total: result.total,
    page: q.page,
    limit: q.limit,
  };
}
export async function readUserExerciseDetail(
  db: PgConnection,
  owner: string,
  q: UserExercisesReadDto,
) {
  validate(owner, q);
  if (!q.recordId) throw new BadRequestException('Exercise ID required');
  const source = await sourceRows(
      db,
      { ...q, from: undefined, to: undefined, status: 'all' },
      true,
    ),
    record = source.rows[0];
  if (!record)
    throw new NotFoundException('Exercise not found for this learner');
  const summary = shape(q.module, record),
    offset = (q.page - 1) * q.limit;
  if (q.module === 'toeic') {
    const questions = Array.isArray(record.question_snapshot)
      ? record.question_snapshot
      : [];
    const option = (q: any, key: string) => {
      const o = q.options?.find((o: any) => o.key === key);
      return o ? `${o.key}. ${o.text}` : key || null;
    };
    return {
      record: summary,
      items: questions
        .slice(offset, offset + q.limit)
        .map((item: any, index: number) => ({
          id: item._id,
          index: offset + index + 1,
          prompt: item.content || `Part ${item.part}`,
          submitted: option(item, record.answers?.[item._id]),
          expected: option(item, item.correctAnswer),
          correct: record.answers?.[item._id]
            ? record.answers[item._id] === item.correctAnswer
            : null,
          occurredAt: null,
          metadata: { part: item.part, explanation: item.explanation },
        })),
      total: questions.length,
      page: q.page,
      limit: q.limit,
    };
  }
  const spec =
    q.module === 'vocabulary'
      ? {
          table: 'learningsessionwords',
          key: 'session_id',
          time: 'answered_at',
        }
      : q.module === 'dictation'
        ? {
            table: 'dictation_learning_events',
            key: 'session_id',
            time: 'occurred_at',
          }
        : q.module === 'arena'
          ? {
              table: 'arenaplayeranswers',
              key: 'match_id',
              time: 'answered_at',
            }
          : null;
  if (!spec)
    return {
      record: summary,
      items: [],
      total: 0,
      page: q.page,
      limit: q.limit,
    };
  const extra = q.module === 'arena' ? ' AND user_id=$4' : '';
  const args =
    q.module === 'arena'
      ? [q.recordId, q.limit, offset, q.userId]
      : [q.recordId, q.limit, offset];
  const entries = (
    await db.query(
      `SELECT * FROM ${spec.table} WHERE ${spec.key}=$1${extra} ORDER BY ${spec.time},id LIMIT $2 OFFSET $3`,
      args,
    )
  ).rows;
  const countArgs =
    q.module === 'arena' ? [q.recordId, q.userId] : [q.recordId];
  const total = Number(
    (
      await db.query(
        `SELECT count(*)::int n FROM ${spec.table} WHERE ${spec.key}=$1${q.module === 'arena' ? ' AND user_id=$2' : ''}`,
        countArgs,
      )
    ).rows[0].n,
  );
  let items: ExerciseRow[] = [];
  if (q.module === 'dictation')
    items = entries.map((r, i) => ({
      id: r.id,
      index: offset + i + 1,
      prompt: r.reference_text ?? r.action,
      submitted: r.submitted_text,
      expected: r.action === 'ATTEMPT' ? r.reference_text : null,
      correct: r.is_correct,
      occurredAt: date(r.occurred_at),
      metadata: { action: r.action, segmentIndex: r.segment_index },
    }));
  if (q.module === 'vocabulary') {
    const ids = [...new Set<string>(entries.map((r) => r.word_id))];
    const words = ids.length
      ? await contentRows(db, 'words', { ids, includeDeleted: true, limit: 50 })
      : [];
    const map = new Map(words.map((w) => [w._id, w]));
    items = entries.map((r, i) => ({
      id: r.id,
      index: offset + i + 1,
      prompt: map.get(r.word_id)?.word ?? 'Vocabulary',
      submitted: r.rating ?? null,
      expected: null,
      correct: r.is_correct,
      occurredAt: date(r.answered_at),
      metadata: { mode: r.mode, rating: r.rating },
    }));
  }
  if (q.module === 'arena') {
    const questions = (
      await db.query(
        'SELECT id,question,correct_answer FROM arenamatchquestions WHERE match_id=$1',
        [q.recordId],
      )
    ).rows;
    const map = new Map(questions.map((r) => [r.id, r]));
    items = entries.map((r, i) => ({
      id: r.id,
      index: offset + i + 1,
      prompt: map.get(r.match_question_id)?.question ?? 'Arena',
      submitted: r.selected_answer,
      expected: map.get(r.match_question_id)?.correct_answer ?? null,
      correct: r.is_correct,
      occurredAt: date(r.answered_at),
      metadata: { points: r.earned_score, attempts: r.attempts },
    }));
  }
  return { record: summary, items, total, page: q.page, limit: q.limit };
}
