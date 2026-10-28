import { BadRequestException,Injectable } from '@nestjs/common';
import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { isUuid } from '../../../postgres/ids.js';
import { first,joinSql,literal,rows,sql,type Sql } from '../../../postgres/sql.js';
import { MiniGameResultQueryDto,TopScoresQueryDto } from '../dto/minigame-result-query.dto.js';
import { MiniGameType } from '../minigame.types.js';
@Injectable()
export class MiniGameAdminService {
  constructor(@InjectPgConnection() private readonly db:PgConnection) {}
  private where(query:MiniGameResultQueryDto):Sql {
    const conditions:Sql[]=[literal('TRUE')];
    if(query.gameType)conditions.push(sql`r.game_type=${query.gameType}`);
    if(query.userId)conditions.push(sql`r.user_id=${query.userId}::uuid`);
    if(query.minScore!==undefined)conditions.push(sql`r.score>=${query.minScore}`);
    if(query.maxScore!==undefined)conditions.push(sql`r.score<=${query.maxScore}`);
    if(query.from)conditions.push(sql`r.created_at>=${new Date(query.from)}`);
    if(query.to){const end=new Date(query.to);end.setUTCDate(end.getUTCDate()+1);conditions.push(sql`r.created_at<${end}`);}
    if(query.search)conditions.push(sql`(u.username ILIKE '%'||${query.search}||'%' OR r.user_id::text=${isUuid(query.search)?query.search:null})`);
    return joinSql(conditions,' AND ');
  }
  async list(query:MiniGameResultQueryDto) {
    if(query.minScore!==undefined&&query.maxScore!==undefined&&query.minScore>query.maxScore)throw new BadRequestException('MIN_SCORE_GREATER_THAN_MAX_SCORE');
    const where=this.where(query),order=literal(({score_desc:'r.score DESC,r.created_at DESC,r.id',score_asc:'r.score ASC,r.created_at DESC,r.id',
      newest:'r.created_at DESC,r.id DESC',oldest:'r.created_at ASC,r.id ASC'} as Record<string,string>)[query.sort??'newest']??'r.created_at DESC,r.id DESC');
    const [items,count]=await Promise.all([
      rows(this.db,sql`SELECT r.id AS "_id",r.user_id AS "userId",r.game_type AS "gameType",r.score,r.created_at AS "createdAt",
        jsonb_build_object('username',u.username) AS player FROM public.minigameresults r LEFT JOIN public.identity_profiles u ON u.id=r.user_id
        WHERE ${where} ORDER BY ${order} LIMIT ${query.limit} OFFSET ${(query.page-1)*query.limit}`),
      first(this.db,sql`SELECT COUNT(*)::integer AS count FROM public.minigameresults r LEFT JOIN public.identity_profiles u ON u.id=r.user_id WHERE ${where}`),
    ]);
    return {items,page:query.page,limit:query.limit,total:Number(count?.count??0)};
  }
  async statistics() {
    const today=new Date();today.setUTCHours(0,0,0,0);
    const [summary,games,daily,bestScores]=await Promise.all([
      first(this.db,sql`SELECT COUNT(*)::integer AS total,COUNT(*) FILTER(WHERE created_at>=${today})::integer AS today,
        COUNT(DISTINCT user_id)::integer AS players FROM public.minigameresults`),
      rows(this.db,sql`SELECT game_type AS "gameType",COUNT(*)::integer AS plays,COUNT(DISTINCT user_id)::integer AS "uniquePlayers",
        MAX(score) AS "bestScore" FROM public.minigameresults GROUP BY game_type ORDER BY plays DESC,game_type`),
      rows(this.db,sql`SELECT TO_CHAR(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS date,COUNT(*)::integer AS plays
        FROM public.minigameresults WHERE created_at>=${new Date(Date.now()-90*86400000)} GROUP BY 1 ORDER BY 1`),
      rows(this.db,sql`SELECT DISTINCT ON(game_type) game_type AS "gameType",score,user_id AS "userId",created_at AS "createdAt"
        FROM public.minigameresults ORDER BY game_type,score DESC,created_at ASC,id`),
    ]);
    return {totalPlays:Number(summary?.total??0),playsToday:Number(summary?.today??0),uniquePlayers:Number(summary?.players??0),
      mostPlayedGame:games[0]?{gameType:games[0].gameType,plays:games[0].plays}:null,games,playsByDay:daily,bestScores};
  }
  async topScores(gameType:string,query:TopScoresQueryDto) {
    if(!Object.values(MiniGameType).includes(gameType as MiniGameType))throw new BadRequestException('MINIGAME_UNSUPPORTED');
    return rows(this.db,sql`WITH best AS (SELECT DISTINCT ON(user_id) user_id,score,created_at FROM public.minigameresults
      WHERE game_type=${gameType} ORDER BY user_id,score DESC,created_at,id)
      SELECT b.user_id AS "userId",b.score,b.created_at AS "createdAt",jsonb_build_object('username',u.username) AS player
      FROM best b LEFT JOIN public.identity_profiles u ON u.id=b.user_id ORDER BY b.score DESC,b.created_at,b.user_id LIMIT ${query.limit}`);
  }
}
