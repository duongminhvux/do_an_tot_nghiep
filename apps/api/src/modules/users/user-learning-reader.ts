import { BadRequestException } from '@nestjs/common';
import type { PgConnection } from '../../postgres/connection.js';
import { isUuid } from '../../postgres/ids.js';
import { ownerRequest } from '../../postgres/owner-client.js';
import { serviceRole } from '../../postgres/ownership.js';
import { first, sql } from '../../postgres/sql.js';

export type ModuleKey = 'VOCABULARY' | 'TOEIC' | 'DICTATION' | 'ARENA' | 'MINIGAME';
export type ModuleProgress = { key: ModuleKey; state: 'ready' | 'unavailable'; lastActivityAt?: string | null; metrics: { key: string; value: number | null; percent?: boolean }[] };
type OwnerProgress = { modules: ModuleProgress[]; summary?: { totalXp: number; activityCount: number; activeSeconds: number } };
const metric = (key: string, value: unknown, percent = false) => ({ key, value: value == null ? null : Number(value), ...(percent ? { percent: true } : {}) });
const rate = (correct: unknown, total: unknown) => Number(total) > 0 ? Math.round(Number(correct) / Number(total) * 100) : null;
const moduleResult = (key: ModuleKey, lastActivityAt: any, metrics: ModuleProgress['metrics']): ModuleProgress => ({ key, state: 'ready', lastActivityAt, metrics });
const ownerModules = { learning: ['VOCABULARY', 'MINIGAME'], assessment: ['TOEIC'], content: ['DICTATION'], arena: ['ARENA'] } as const;
export async function readUserLearning(db: PgConnection, owner: string, userId: string): Promise<OwnerProgress> {
  if (!isUuid(userId) || !Object.hasOwn(ownerModules, owner)) throw new BadRequestException('Invalid user learning projection');
  if (owner === 'learning') {
    const [vocab, games, activity, time] = await Promise.all([
      first(db, sql`SELECT
        (SELECT COUNT(*)::int FROM userwordreviews WHERE user_id=${userId}::uuid) AS learned,
        (SELECT COUNT(*)::int FROM userwordreviews WHERE user_id=${userId}::uuid AND status='MASTERED') AS mastered,
        (SELECT COUNT(*)::int FROM userwordreviews WHERE user_id=${userId}::uuid AND next_review_at<=now()) AS due,
        (SELECT COUNT(*)::int FROM userlessonprogresses WHERE user_id=${userId}::uuid AND status='COMPLETED') AS completed,
        (SELECT SUM(correct_count) FROM userwordreviews WHERE user_id=${userId}::uuid) AS correct,
        (SELECT SUM(COALESCE(correct_count,0)+COALESCE(incorrect_count,0)) FROM userwordreviews WHERE user_id=${userId}::uuid) AS total,
        (SELECT MAX(last_reviewed_at) FROM userwordreviews WHERE user_id=${userId}::uuid) AS last`),
      first(db, sql`SELECT COUNT(*)::int rounds, COUNT(DISTINCT game_type)::int games, MAX(created_at) AS last FROM minigameresults WHERE user_id=${userId}::uuid`),
      first(db, sql`SELECT COALESCE(SUM(xp),0)::float8 xp, COUNT(*) FILTER(WHERE type NOT IN ('WORD_LEARNED','WORD_REVIEWED'))::int count FROM learning_activities WHERE user_id=${userId}::uuid`),
      first(db, sql`SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at-started_at))),0)::float8 seconds FROM user_active_time_slices WHERE user_id=${userId}::uuid AND ended_at>started_at`),
    ]);
    return { summary: { totalXp: Number(activity?.xp ?? 0), activityCount: Number(activity?.count ?? 0), activeSeconds: Number(time?.seconds ?? 0) }, modules: [
      moduleResult('VOCABULARY', vocab?.last, [metric('wordsLearned', vocab?.learned), metric('wordsMastered', vocab?.mastered), metric('wordsDue', vocab?.due), metric('lessonsCompleted', vocab?.completed), metric('accuracy', rate(vocab?.correct, vocab?.total), true)]),
      moduleResult('MINIGAME', games?.last, [metric('roundsPlayed', games?.rounds), metric('gameTypes', games?.games)]),
    ] };
  }
  if (owner === 'assessment') {
    const data = await first(db, sql`SELECT COUNT(*)::int attempts, COUNT(*) FILTER(WHERE status IN ('FINISHED','COMPLETED'))::int completed,
      COUNT(*) FILTER(WHERE status='IN_PROGRESS')::int ongoing,
      SUM(COALESCE(total_correct,correct_answers,0)) FILTER(WHERE status IN ('FINISHED','COMPLETED')) AS correct,
      SUM(total_questions) FILTER(WHERE status IN ('FINISHED','COMPLETED')) AS total,
      MAX(100.0*COALESCE(total_correct,correct_answers,0)/NULLIF(total_questions,0)) FILTER(WHERE status IN ('FINISHED','COMPLETED')) AS best,
      MAX(COALESCE(completed_at,started_at)) AS last FROM attempts WHERE user_id=${userId}::uuid`);
    return { modules: [moduleResult('TOEIC', data?.last, [metric('attempts', data?.attempts), metric('attemptsCompleted', data?.completed), metric('attemptsInProgress', data?.ongoing), metric('accuracy', rate(data?.correct,data?.total), true), metric('bestAccuracy', data?.best == null ? null : Math.round(Number(data.best)), true)])] };
  }
  if (owner === 'content') {
    const data = await first(db, sql`SELECT COUNT(*)::int lessons, COUNT(*) FILTER(WHERE completed IS TRUE)::int completed,
      COALESCE(SUM(jsonb_array_length(completed_segments)),0)::int segments,
      SUM(correct_count) correct, SUM(COALESCE(correct_count,0)+COALESCE(wrong_count,0)) total,
      MAX(last_practiced_at) last FROM dictationprogresses WHERE user_id=${userId}::uuid`);
    return { modules: [moduleResult('DICTATION', data?.last, [metric('lessonsStarted',data?.lessons), metric('lessonsCompleted',data?.completed), metric('segmentsCompleted',data?.segments), metric('accuracy',rate(data?.correct,data?.total),true)])] };
  }
  const data = await first(db, sql`SELECT rating, ranked_matches matches, ranked_wins wins, ranked_losses losses, ranked_draws draws, best_win_streak streak,
    (SELECT MAX(created_at) FROM arenaratinghistories WHERE user_id=${userId}::uuid) last FROM arenaprofiles WHERE user_id=${userId}::uuid`);
  return { modules: [moduleResult('ARENA', data?.last, [metric('rankedMatches',data?.matches ?? 0), metric('wins',data?.wins ?? 0), metric('losses',data?.losses ?? 0), metric('draws',data?.draws ?? 0), metric('rating',data?.rating), metric('winRate',rate(data?.wins,data?.matches),true)])] };
}
export async function userLearningProgress(db: PgConnection, userId: string): Promise<{summary:OwnerProgress['summary']|null;modules:ModuleProgress[]}> {
  const owners = Object.keys(ownerModules) as (keyof typeof ownerModules)[];
  const results = await Promise.allSettled(owners.map(owner => serviceRole() === owner ? readUserLearning(db,owner,userId) : ownerRequest<OwnerProgress>(owner, `user-learning/${owner}`, { userId })));
  const modules: ModuleProgress[] = []; let summary: OwnerProgress['summary'] | null = null;
  results.forEach((result,index) => {
    if (result.status === 'fulfilled') { modules.push(...result.value.modules); if (result.value.summary) summary = result.value.summary; }
    else modules.push(...ownerModules[owners[index]!].map(key => ({ key, state: 'unavailable' as const, metrics: [] })));
  });
  return { summary, modules };
}
