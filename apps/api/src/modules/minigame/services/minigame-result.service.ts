import { BadRequestException,Injectable,Optional } from '@nestjs/common';
import { XP } from '@repo/shared-types/learning-xp';
import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { first,rowData,rows,sql } from '../../../postgres/sql.js';
import { LearningActivityService } from '../../learning-activity/learning-activity.service.js';
import type { CreateMiniGameResultDto } from '../dto/create-minigame-result.dto.js';
import { MiniGameType } from '../minigame.types.js';
@Injectable()
export class MiniGameResultService {
  constructor(
    @InjectPgConnection() private readonly db: PgConnection,
    @Optional()
    private readonly learningActivity?: LearningActivityService,
  ) {}
  private game(value: string) {
    if (!Object.values(MiniGameType).includes(value as MiniGameType))
      throw new BadRequestException('MINIGAME_UNSUPPORTED');
    return value as MiniGameType;
  }
  async save(userId: string, dto: CreateMiniGameResultDto) {
    this.game(dto.gameType);
    if (!Number.isInteger(dto.score) || dto.score < 0 || dto.score > 10_000_000)
      throw new BadRequestException('MINIGAME_INVALID_SCORE');
    const raw = await first(this.db,sql`INSERT INTO public.minigameresults (user_id,game_type,score)
      VALUES (${userId}::uuid,${dto.gameType},${dto.score}) RETURNING *`);
    const result=rowData<any>(raw!);
    await this.learningActivity?.record({
      userId,
      module: 'MINIGAME',
      type: 'MINIGAME_PLAY',
      sourceKey: `minigame:${result._id}`,
      xp: XP.MINIGAME_PLAY,
      occurredAt: result.createdAt,
      refId: String(result._id),
      link: '/games',
      score: result.score,
      metadata: { gameType: result.gameType } });
    return {
      id: String(result._id),
      score: result.score,
      createdAt: result.createdAt };
  }
  async stats(userId: string, value: string) {
    const game=this.game(value);
    const [best,recent,count]=await Promise.all([
      first(this.db,sql`SELECT MAX(score) AS score FROM public.minigameresults WHERE user_id=${userId}::uuid AND game_type=${game}`),
      rows(this.db,sql`SELECT id AS "_id",score,created_at AS "createdAt" FROM public.minigameresults
        WHERE user_id=${userId}::uuid AND game_type=${game} ORDER BY created_at DESC,id DESC LIMIT 10`),
      first(this.db,sql`SELECT COUNT(*)::integer AS total FROM public.minigameresults WHERE user_id=${userId}::uuid AND game_type=${game}`),
    ]);
    const totalPlays=Number(count?.total??0);
    return {
      bestScore: best?.score ?? 0,
      totalPlays,
      recentScores: recent.map((r) => ({
        id: String(r._id),
        score: r.score,
        createdAt: r.createdAt })) };
  }
}
