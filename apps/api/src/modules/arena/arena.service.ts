import { Injectable,Optional } from '@nestjs/common';
import { InjectPgConnection,type PgConnection } from '../../postgres/connection.js';
import { first,rowData,rows,sql } from '../../postgres/sql.js';
import { ARENA_DEFAULTS } from './admin/arena-settings.defaults.js';
import { ArenaSettingsService } from './admin/arena-settings.service.js';
import { ArenaReadService } from './arena-read.service.js';

export function arenaTodayRange(now = new Date()) {
  const local = new Date(now.getTime() + 7 * 3600000);
  local.setUTCHours(0, 0, 0, 0);
  const start = new Date(local.getTime() - 7 * 3600000);
  return { start, end: new Date(start.getTime() + 24 * 3600000) };
}

@Injectable()
export class ArenaService {
  constructor(
    private readonly arenaReadService: ArenaReadService,
    @InjectPgConnection() private readonly db: PgConnection,
    @Optional() private readonly settings?: ArenaSettingsService,
  ) {}

  /** Elo hiện tại cùng tổng thay đổi trong ngày và thống kê ranked của chính người dùng. */
  async getMyArenaOverview(userId: string) {
    const profile = await this.getOrCreateProfile(userId);
    if (!profile) throw new Error('Arena profile could not be created');
    const { start, end } = arenaTodayRange();
    const [ranked, leaderboard, changes] = await Promise.all([
      this.arenaReadService.getRankedStatistics(userId),
      this.arenaReadService.getLeaderboard(userId, 'all', 1),
      rows(this.db,sql`SELECT COALESCE(SUM(change),0) AS total FROM public.arenaratinghistories
        WHERE user_id=${userId}::uuid AND created_at>=${start} AND created_at<${end}`),
    ]);
    return {
      userId: String(profile.userId),
      rating: profile.rating,
      todayRatingChange: changes[0]?.total ?? 0,
      leaderboard: {
        position: leaderboard.me?.position ?? null,
        topPercent:
          leaderboard.me && leaderboard.totalPlayers > 0
            ? Math.max(
                1,
                Math.ceil(
                  (leaderboard.me.position / leaderboard.totalPlayers) * 100,
                ),
              )
            : null,
        totalPlayers: leaderboard.totalPlayers },
      ranked };
  }

  /** Lấy profile có sẵn hoặc tạo profile Arena mặc định cho người dùng mới. */
  async getOrCreateProfile(userId: string) {
    const config = this.settings
      ? await this.settings.current()
      : ARENA_DEFAULTS;

    const row=await first(this.db,sql`INSERT INTO public.arenaprofiles
      (user_id,rating,ranked_matches,ranked_wins,ranked_losses,ranked_draws,current_win_streak,best_win_streak)
      VALUES (${userId}::uuid,${config.ranked.defaultRating},0,0,0,0,0,0)
      ON CONFLICT (user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING *`);
    return rowData<any>(row!);
  }

  /** Lấy profile Arena thô theo user ID cho các service nội bộ. */
  async getProfile(userId: string) {
    const row=await first(this.db,sql`SELECT * FROM public.arenaprofiles WHERE user_id=${userId}::uuid`);
    return row?rowData<any>(row):null;
  }
}
