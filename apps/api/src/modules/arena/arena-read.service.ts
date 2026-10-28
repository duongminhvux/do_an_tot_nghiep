import { BadRequestException,Injectable,NotFoundException } from '@nestjs/common';
import { InjectPgConnection,type PgConnection } from '../../postgres/connection.js';
import { isUuid } from '../../postgres/ids.js';
import { first,rows,sql } from '../../postgres/sql.js';
export type ArenaRankingPeriod = 'week' | 'month' | 'all';
export type ArenaRankingEntry = {
  userId: string;
  name: string;
  avatarUrl?: string;
  rating: number;
  matches: number;
  wins: number;
  position: number;
};
export type ArenaRecentMatch = {
  id: string;
  name: string;
  avatarUrl?: string;
  score: [number, number];
  result: 'WIN' | 'LOSS' | 'DRAW';
  mode: 'rank' | 'friend' | 'word-chain' | 'word-guess' | 'room';
  points: number;
  finishedAt: Date;
};

export function arenaPeriodStart(period: ArenaRankingPeriod, now = new Date()) {
  /** 'all' không giới hạn thời gian nên không cần mốc bắt đầu. */
  if (period === 'all') return undefined;
  // Calendar periods in Asia/Ho_Chi_Minh (UTC+7), with weeks starting Monday.
  const local = new Date(now.getTime() + 7 * 3600000);
  local.setUTCHours(0, 0, 0, 0);
  if (period === 'month') local.setUTCDate(1);
  else local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return new Date(local.getTime() - 7 * 3600000);
}


@Injectable()
export class ArenaReadService {
  constructor(@InjectPgConnection() private readonly db:PgConnection) {}
  private userId(value:string) {
    if(!isUuid(value))throw new BadRequestException('Invalid user ID');return value;
  }
  private limit(value:number) {
    if(!Number.isInteger(value)||value<1||value>50)throw new BadRequestException('Limit must be between 1 and 50');return value;
  }
  async getMatchAudio(userId:string,matchId:string) {
    const row=await first(this.db,sql`SELECT COALESCE(m.payload->'audioSettings','{}'::jsonb) AS audio
      FROM public.arenamatches m JOIN public.arenamatchplayers p ON p.match_id=m.id
      WHERE m.id=${this.userId(matchId)}::uuid AND p.user_id=${this.userId(userId)}::uuid LIMIT 1`);
    if(!row)throw new NotFoundException('ARENA_MATCH_NOT_FOUND');return row.audio;
  }
  getRecentMatches(userId:string,limit=20):Promise<ArenaRecentMatch[]> {
    return rows(this.db,sql`SELECT m.id::text AS id,
      CASE WHEN u.is_deleted THEN 'Người chơi' ELSE COALESCE(u.username,'Người chơi') END AS name,
      CASE WHEN u.is_deleted THEN NULL ELSE u.avatar_url END AS "avatarUrl",
      jsonb_build_array(p.score,COALESCE(opponent.score,0)) AS score,
      CASE WHEN m.is_draw THEN 'DRAW' WHEN m.winner_id=p.user_id THEN 'WIN' ELSE 'LOSS' END AS result,
      CASE WHEN m.friend_mode='WORD_GUESS' THEN 'word-guess' WHEN m.type='RANK' THEN 'rank'
        WHEN m.type='FRIEND' AND m.friend_mode='WORD_CHAIN' THEN 'word-chain' WHEN m.type='FRIEND' THEN 'friend' ELSE 'room' END AS mode,
      COALESCE(p.rating_change,0) AS points,m.finished_at AS "finishedAt"
      FROM public.arenamatchplayers p JOIN public.arenamatches m ON m.id=p.match_id
      LEFT JOIN LATERAL (SELECT o.user_id,o.score FROM public.arenamatchplayers o
        WHERE o.match_id=p.match_id AND o.user_id<>p.user_id ORDER BY o.score DESC,o.user_id LIMIT 1) opponent ON true
      LEFT JOIN public.identity_profiles u ON u.id=opponent.user_id
      WHERE p.user_id=${this.userId(userId)}::uuid AND m.status='FINISHED'
      ORDER BY m.finished_at DESC,m.id DESC LIMIT ${this.limit(limit)}`);
  }
  async getLeaderboard(userId:string,period:string='week',limit=5) {
    if(!['week','month','all'].includes(period))throw new BadRequestException('Invalid ranking period');
    const id=this.userId(userId),cap=this.limit(limit),since=arenaPeriodStart(period as ArenaRankingPeriod)??null;
    const result=await first(this.db,sql`WITH eligible AS (
      SELECT p.user_id,COUNT(*)::integer AS matches,COUNT(*) FILTER(WHERE m.winner_id=p.user_id)::integer AS wins,
        MAX(COALESCE(p.rating_after,p.rating_before)) AS fallback_rating
      FROM public.arenamatchplayers p JOIN public.arenamatches m ON m.id=p.match_id
      WHERE m.status='FINISHED' AND m.type='RANK' AND (${since}::timestamptz IS NULL OR m.finished_at>=${since}) GROUP BY p.user_id
    ), ranked AS (
      SELECT e.user_id AS "userId",COALESCE(u.username,'Người chơi') AS name,u.avatar_url AS "avatarUrl",
        e.matches,e.wins,COALESCE(a.rating,e.fallback_rating,0) AS rating,
        RANK() OVER(ORDER BY COALESCE(a.rating,e.fallback_rating,0) DESC)::integer AS position
      FROM eligible e JOIN public.identity_profiles u ON u.id=e.user_id AND u.is_deleted IS NOT TRUE
      LEFT JOIN public.arenaprofiles a ON a.user_id=e.user_id
    ) SELECT (SELECT COALESCE(jsonb_agg(to_jsonb(top_players)),'[]'::jsonb) FROM
        (SELECT * FROM ranked ORDER BY position,wins DESC,"userId" LIMIT ${cap}) top_players) AS players,
      (SELECT to_jsonb(me) FROM ranked me WHERE me."userId"=${id}::uuid LIMIT 1) AS me,
      (SELECT COUNT(*)::integer FROM ranked) AS total`);
    return {period:period as ArenaRankingPeriod,players:(result?.players??[]) as ArenaRankingEntry[],
      me:(result?.me??null) as ArenaRankingEntry|null,totalPlayers:Number(result?.total??0)};
  }
  async getRankedStatistics(userId:string) {
    const stats=await first(this.db,sql`WITH results AS (
      SELECT m.finished_at,m.id,(m.winner_id=p.user_id) IS TRUE AS won,m.is_draw IS TRUE AS draw
      FROM public.arenamatchplayers p JOIN public.arenamatches m ON m.id=p.match_id
      WHERE p.user_id=${this.userId(userId)}::uuid AND m.type='RANK' AND m.status='FINISHED'
    ), runs AS (SELECT *,SUM(CASE WHEN won THEN 0 ELSE 1 END) OVER(ORDER BY finished_at,id) AS streak_group FROM results),
    streaks AS (SELECT streak_group,COUNT(*)::integer AS length FROM runs WHERE won GROUP BY streak_group)
    SELECT COUNT(*)::integer AS matches,COUNT(*) FILTER(WHERE won)::integer AS wins,COUNT(*) FILTER(WHERE draw)::integer AS draws,
      COALESCE((SELECT MAX(length) FROM streaks),0) AS best,
      COALESCE((SELECT length FROM streaks WHERE streak_group=(SELECT MAX(streak_group) FROM runs)
        AND (SELECT won FROM results ORDER BY finished_at DESC,id DESC LIMIT 1)),0) AS current FROM results`);
    const matches=Number(stats?.matches??0),wins=Number(stats?.wins??0),draws=Number(stats?.draws??0);
    return {matches,wins,draws,losses:matches-wins-draws,winRate:matches?Number((wins/matches*100).toFixed(1)):0,
      currentWinStreak:Number(stats?.current??0),bestWinStreak:Number(stats?.best??0)};
  }
}
