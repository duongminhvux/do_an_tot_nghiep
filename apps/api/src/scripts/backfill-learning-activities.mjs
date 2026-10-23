// Seeds `learning_activities` from results recorded before the activity log
// existed, so streaks, the heatmap and recent activity are not empty.
//
//   pnpm --filter api backfill:activities
//
// Uses the same source keys as live recording and only inserts missing rows
// ($setOnInsert), so it is safe to run any number of times.
import mongoose from 'mongoose';
import {
  XP,
  arenaMatchXp,
  dictationLessonXp,
  toeicAttemptXp,
} from '@repo/shared-types/learning-xp';
import { estimateToeicScore } from '@repo/shared-types/toeic-score';
import { loadRootEnv } from './load-root-env.mjs';

loadRootEnv();

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/english-platform';
const BATCH = 500;

const seconds = (from, to) =>
  from && to
    ? Math.max(0, Math.round((new Date(to) - new Date(from)) / 1000))
    : undefined;

async function lookup(db, collection, ids, fields) {
  const unique = [...new Set(ids.filter(Boolean).map(String))].map(
    (id) => new mongoose.Types.ObjectId(id),
  );
  const rows = unique.length
    ? await db
        .collection(collection)
        .find({ _id: { $in: unique } }, { projection: fields })
        .toArray()
    : [];
  return new Map(rows.map((row) => [String(row._id), row]));
}

async function* toeic(db) {
  const attempts = await db
    .collection('attempts')
    .find({ status: { $in: ['FINISHED', 'COMPLETED'] } })
    .toArray();
  const exams = await lookup(
    db,
    'exams',
    attempts.map((a) => a.examId),
    { name: 1 },
  );
  for (const a of attempts) {
    const correct = a.correctAnswers ?? a.totalCorrect ?? 0;
    yield {
      userId: a.userId,
      module: 'TOEIC',
      type: 'TOEIC_ATTEMPT',
      sourceKey: `toeic:${a._id}`,
      xp: toeicAttemptXp(correct),
      occurredAt: a.submittedAt ?? a.completedAt ?? a.updatedAt ?? a.createdAt,
      title: a.examSnapshot?.name ?? exams.get(String(a.examId))?.name,
      refId: String(a._id),
      link: `/toeic/attempts/${a._id}/result`,
      correct,
      total: a.totalQuestions,
      score:
        a.mode === 'TEST'
          ? estimateToeicScore(a.listeningResult, a.readingResult)?.total
          : undefined,
      durationSec: a.durationSpent,
      metadata: { mode: a.mode, selectedParts: a.selectedParts },
    };
  }
}

async function* arena(db) {
  const players = await db
    .collection('arenamatchplayers')
    .find({ status: 'FINISHED' })
    .toArray();
  const matches = await lookup(
    db,
    'arenamatches',
    players.map((p) => p.matchId),
    { type: 1, status: 1, winnerId: 1, isDraw: 1, startedAt: 1, finishedAt: 1 },
  );
  for (const p of players) {
    const match = matches.get(String(p.matchId));
    if (match?.status !== 'FINISHED') continue;
    const won = !match.isDraw && String(match.winnerId) === String(p.userId);
    const finishedAt = p.finishedAt ?? match.finishedAt;
    yield {
      userId: p.userId,
      module: 'ARENA',
      type: 'ARENA_MATCH',
      sourceKey: `arena:${p.matchId}`,
      xp: arenaMatchXp(won),
      occurredAt: finishedAt,
      refId: String(p.matchId),
      link: '/arena',
      correct: p.correctAnswers,
      total:
        (p.correctAnswers ?? 0) + (p.wrongAnswers ?? 0) + (p.unanswered ?? 0),
      score: p.score,
      durationSec: seconds(match.startedAt, finishedAt),
      metadata: {
        matchType: match.type,
        won,
        isDraw: Boolean(match.isDraw),
        ratingChange: p.ratingChange ?? 0,
      },
    };
  }
}

async function* minigames(db) {
  for await (const r of db.collection('minigameresults').find({})) {
    yield {
      userId: r.userId,
      module: 'MINIGAME',
      type: 'MINIGAME_PLAY',
      sourceKey: `minigame:${r._id}`,
      xp: XP.MINIGAME_PLAY,
      occurredAt: r.createdAt,
      refId: String(r._id),
      link: '/games',
      score: r.score,
      metadata: { gameType: r.gameType },
    };
  }
}

async function* dictation(db) {
  const progress = await db
    .collection('dictationprogresses')
    .find({ completed: true })
    .toArray();
  const lessons = await lookup(
    db,
    'dictationlessons',
    progress.map((p) => p.lessonId),
    { title: 1, slug: 1, sentenceCount: 1, totalDurationMs: 1 },
  );
  for (const p of progress) {
    const lesson = lessons.get(String(p.lessonId));
    const firstTry = (p.segmentProgress ?? []).filter(
      (s) => s.firstTryCorrect,
    ).length;
    yield {
      userId: p.userId,
      module: 'DICTATION',
      type: 'DICTATION_LESSON',
      sourceKey: `dictation:${p._id}`,
      xp: dictationLessonXp(firstTry),
      occurredAt: p.lastPracticedAt ?? p.updatedAt,
      title: lesson?.title,
      refId: String(p.lessonId),
      link: lesson?.slug ? `/dictation/${lesson.slug}` : '/dictation',
      correct: p.completedSegments?.length ?? 0,
      total: lesson?.sentenceCount,
      durationSec: lesson?.totalDurationMs
        ? Math.round(lesson.totalDurationMs / 1000)
        : undefined,
      metadata: {
        firstTryCorrect: firstTry,
        revealed: p.revealedSegments?.length ?? 0,
      },
    };
  }
}

async function* vocabulary(db) {
  const sessions = await db
    .collection('learningsessions')
    .find({ endedAt: { $ne: null } })
    .toArray();
  const lessons = await lookup(
    db,
    'lessons',
    sessions.map((s) => s.lessonId),
    { title: 1 },
  );
  for (const s of sessions) {
    yield {
      userId: s.userId,
      module: 'VOCABULARY',
      type: 'VOCAB_SESSION',
      sourceKey: `vocab-session:${s._id}`,
      xp: XP.VOCAB_SESSION,
      occurredAt: s.endedAt,
      title: lessons.get(String(s.lessonId))?.title,
      refId: String(s._id),
      link: '/vocabulary',
      correct: s.completedWords,
      total: s.totalWords,
      durationSec: s.durationSeconds ?? seconds(s.startedAt, s.endedAt),
      metadata: { sessionType: s.type },
    };
  }
  // Only the first and the latest review of each word can be reconstructed.
  for await (const r of db.collection('userwordreviews').find({})) {
    if (!r.reviewCount) continue;
    yield {
      userId: r.userId,
      module: 'VOCABULARY',
      type: 'WORD_LEARNED',
      sourceKey: `vocab-word:${r._id}:1`,
      xp: XP.WORD_LEARNED,
      occurredAt: r.createdAt,
      refId: String(r._id),
    };
    if (r.reviewCount > 1 && r.lastReviewedAt)
      yield {
        userId: r.userId,
        module: 'VOCABULARY',
        type: 'WORD_REVIEWED',
        sourceKey: `vocab-word:${r._id}:${r.reviewCount}`,
        xp: XP.WORD_REVIEWED,
        occurredAt: r.lastReviewedAt,
        refId: String(r._id),
      };
  }
}

async function upsertAll(target, source) {
  let seen = 0;
  let inserted = 0;
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const result = await target.bulkWrite(batch, { ordered: false });
    inserted += result.upsertedCount;
    batch = [];
  };
  for await (const activity of source) {
    if (!activity.userId || !activity.occurredAt) continue;
    seen++;
    const { userId, sourceKey, ...fields } = activity;
    const clean = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    );
    batch.push({
      updateOne: {
        filter: { userId: new mongoose.Types.ObjectId(String(userId)), sourceKey },
        update: {
          $setOnInsert: {
            ...clean,
            occurredAt: new Date(activity.occurredAt),
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    });
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  return { seen, inserted };
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const target = db.collection('learning_activities');
  await target.createIndex({ userId: 1, sourceKey: 1 }, { unique: true });
  await target.createIndex({ userId: 1, occurredAt: -1 });
  await target.createIndex({ userId: 1, module: 1, occurredAt: -1 });

  const sources = { toeic, arena, minigames, dictation, vocabulary };
  for (const [name, source] of Object.entries(sources)) {
    const { seen, inserted } = await upsertAll(target, source(db));
    console.log(`${name}: ${seen} found, ${inserted} added`);
  }
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
