import { BadRequestException,ConflictException,Injectable,NotFoundException } from '@nestjs/common';
import { NotificationClient } from '../../../common/clients/notification-client.js';
import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { isUuid } from '../../../postgres/ids.js';
import { SqlRecords } from '../../../postgres/records.js';
import { first,identifier,joinSql,literal,rows,sql,type Sql } from '../../../postgres/sql.js';
import { ArenaReadService } from '../arena-read.service.js';
import { arenaTodayRange } from '../arena.service.js';
import { ArenaFriendRoomService } from '../friendly/arena-friend-room.service.js';
import { ArenaGateway } from '../gateways/arena.gateway.js';
import { ArenaPresenceService } from '../presence/arena-presence.service.js';
import { ArenaAdminQuery,ArenaDashboardQuery,ArenaPlayerQuery,ArenaRoomQuery,UpdateArenaSettingsDto } from './arena-admin.dto.js';
import { ArenaSettingsService } from './arena-settings.service.js';
const timestamp = (value: Date | string | null | undefined): number =>
  value == null ? NaN : new Date(value).getTime();
const matchDuration = (
  startedAt: Date | string | null | undefined,
  finishedAt: Date | string | null | undefined,
): number | null => {
  const elapsed = timestamp(finishedAt) - timestamp(startedAt);
  return Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed / 1000)) : null;
};

@Injectable()
export class ArenaAdminService {
  constructor(@InjectPgConnection() private readonly db:PgConnection,
    private readonly presence:ArenaPresenceService,private readonly friendRooms:ArenaFriendRoomService,
    private readonly gateway:ArenaGateway,private readonly settings:ArenaSettingsService,
    private readonly logs:NotificationClient,private readonly reads:ArenaReadService) {}
  private get matches(){return new SqlRecords(this.db,'arenamatches');}
  private get participants(){return new SqlRecords(this.db,'arenamatchplayers');}
  private get questions(){return new SqlRecords(this.db,'arenamatchquestions');}
  private get answers(){return new SqlRecords(this.db,'arenaplayeranswers');}
  private get profiles(){return new SqlRecords(this.db,'arenaprofiles');}
  private get ratings(){return new SqlRecords(this.db,'arenaratinghistories');}
  private get rooms(){return new SqlRecords(this.db,'friendrooms');}
  private get users(){return new SqlRecords(this.db,'identity_profiles');}
  private id(value:string){if(!isUuid(value))throw new BadRequestException('INVALID_ID');return value;}
  private dates(from?:string,to?:string):Sql {
    if(from&&to&&new Date(from)>new Date(to))throw new BadRequestException('INVALID_DATE_RANGE');
    return sql`(${from?new Date(from):null}::timestamptz IS NULL OR created_at>=${from?new Date(from):null})
      AND (${to?new Date(to):null}::timestamptz IS NULL OR created_at<=${to?new Date(to):null})`;
  }
  private async userMap(ids:unknown[]) {
    const users=await this.users.select(sql`id=ANY(${[...new Set(ids.filter(Boolean).map(String))]}::uuid[])`);
    return new Map<string,any>(users.map(user=>[String(user._id),user]));
  }
  private async enrichMatches(matches:any[]) {
    const players=await this.participants.select(sql`match_id=ANY(${matches.map(match=>String(match._id))}::uuid[])`,literal('ORDER BY created_at,user_id'));
    const users=await this.userMap(players.map(p=>p.userId));
    return matches.map(match=>({...match,duration:matchDuration(match.startedAt,match.finishedAt),
      players:players.filter(p=>p.matchId===match._id).map(p=>{
        const {ratingBefore,ratingAfter,ratingChange,scoredQuestionIds,...rest}=p;
        return {...rest,user:users.get(String(p.userId))??null,...(match.type==='RANK'?{ratingBefore,ratingAfter,ratingChange}:{})};
      })}));
  }
  private rawMatches(where:Sql,offset=0,limit=20){return this.matches.select(where,sql`ORDER BY created_at DESC,id DESC LIMIT ${limit} OFFSET ${offset}`);}
  async matchList(query:ArenaAdminQuery) {
    const conditions:Sql[]=[this.dates(query.from,query.to)];
    if(query.type)conditions.push(sql`type=${query.type}`);
    if(query.status)conditions.push(sql`status=${query.status}`);
    if(query.winnerId)conditions.push(sql`winner_id=${this.id(query.winnerId)}::uuid`);
    if(query.finishReason)conditions.push(sql`finish_reason #>> '{}'=${query.finishReason}`);
    if(query.matchId)conditions.push(sql`id=${this.id(query.matchId)}::uuid`);
    if(query.search){if(!isUuid(query.search))return {items:[],total:0,page:query.page,limit:query.limit};conditions.push(sql`id=${query.search}::uuid`);}
    if(query.mode)conditions.push(sql`(friend_mode=${query.mode} OR question_mode #>> '{}'=${query.mode})`);
    if(query.userId)conditions.push(sql`EXISTS(SELECT 1 FROM public.arenamatchplayers p WHERE p.match_id=arenamatches.id AND p.user_id=${this.id(query.userId)}::uuid)`);
    const where=joinSql(conditions,' AND ');
    const [matches,total]=await Promise.all([this.rawMatches(where,(query.page-1)*query.limit,query.limit),this.matches.count(where)]);
    return {items:await this.enrichMatches(matches),total,page:query.page,limit:query.limit};
  }
  async matchDetail(id:string) {
    const match=await this.matches.one(sql`id=${this.id(id)}::uuid`);if(!match)throw new NotFoundException('MATCH_NOT_FOUND');
    const [questions,answers]=await Promise.all([this.questions.select(sql`match_id=${id}::uuid`,literal('ORDER BY "order"')),
      this.answers.select(sql`match_id=${id}::uuid`,literal('ORDER BY answered_at LIMIT 10000'))]);
    return {...(await this.enrichMatches([match]))[0],questions,answers};
  }
  async dashboard(query:ArenaDashboardQuery) {
    const {start,end}=arenaTodayRange(),since=new Date(start.getTime()-(query.days-1)*86400000);
    const [today,activeMatches,waitingRooms,online,daily,distribution,reasons,recent]=await Promise.all([
      rows(this.db,sql`SELECT type AS "_id",COUNT(*)::integer AS count,COUNT(*) FILTER(WHERE status='CANCELLED')::integer AS cancelled
        FROM public.arenamatches WHERE created_at>=${start} AND created_at<${end} GROUP BY type`),
      this.matches.count(sql`status=ANY(${['COUNTDOWN','PLAYING','PAUSED','RESUMING','FINISHING']}::text[])`),
      this.rooms.count(sql`status='WAITING'`),this.presence.overview().catch(()=>({onlineCount:null})),
      rows(this.db,sql`SELECT TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') AS "_id",COUNT(*)::integer AS count
        FROM public.arenamatches WHERE created_at>=${since} AND created_at<${end} GROUP BY 1 ORDER BY 1`),
      rows(this.db,sql`SELECT type AS "_id",COUNT(*)::integer AS count FROM public.arenamatches WHERE created_at>=${since} AND created_at<${end} GROUP BY type`),
      rows(this.db,sql`SELECT CASE WHEN status='CANCELLED' THEN 'CANCELLED' ELSE COALESCE(finish_reason #>> '{}','UNKNOWN') END AS "_id",COUNT(*)::integer AS count
        FROM public.arenamatches WHERE created_at>=${since} AND created_at<${end} AND status IN('FINISHED','CANCELLED') GROUP BY 1`),
      this.matchList(Object.assign(new ArenaAdminQuery(),{limit:8})),
    ]);
    const counts=Object.fromEntries(today.map(row=>[row._id,row.count]));
    return {matchesToday:today.reduce((n,r)=>n+r.count,0),rankedToday:counts.RANK??0,friendlyToday:counts.FRIEND??0,groupToday:counts.ROOM??0,
      cancelledToday:today.reduce((n,r)=>n+r.cancelled,0),activeMatches,waitingRooms,onlineArenaUsers:online.onlineCount,daily,distribution,reasons,recent:recent.items,days:query.days};
  }
  async playerList(query:ArenaPlayerQuery) {
    if(query.minRating!==undefined&&query.maxRating!==undefined&&query.minRating>query.maxRating)throw new BadRequestException('INVALID_RATING_RANGE');
    const conditions:Sql[]=[literal('TRUE')];
    if(query.minRating!==undefined)conditions.push(sql`a.rating>=${query.minRating}`);
    if(query.maxRating!==undefined)conditions.push(sql`a.rating<=${query.maxRating}`);
    if(query.minMatches!==undefined)conditions.push(sql`a.ranked_matches>=${query.minMatches}`);
    if(query.activeSince)conditions.push(sql`COALESCE(last.updated_at,a.updated_at)>=${new Date(query.activeSince)}`);
    if(query.search)conditions.push(sql`(u.username ILIKE '%'||${query.search}||'%' OR a.user_id::text=${isUuid(query.search)?query.search:null})`);
    const orders:Record<string,Sql>={rating:sql`a.rating`,rankedMatches:sql`a.ranked_matches`,winRate:sql`CASE WHEN a.ranked_matches>0 THEN a.ranked_wins/a.ranked_matches*100 ELSE 0 END`,lastActivity:sql`COALESCE(last.updated_at,a.updated_at)`};
    const where=joinSql(conditions,' AND '),order=orders[query.sort]??orders.rating;
    const querySql=sql`FROM public.arenaprofiles a LEFT JOIN public.identity_profiles u ON u.id=a.user_id
      LEFT JOIN LATERAL(SELECT updated_at FROM public.arenamatchplayers p WHERE p.user_id=a.user_id ORDER BY created_at DESC,id DESC LIMIT 1) last ON true WHERE ${where}`;
    const [items,count]=await Promise.all([
      rows(this.db,sql`SELECT a.id AS "_id",a.user_id AS "userId",a.rating,a.ranked_matches AS "rankedMatches",a.ranked_wins AS "rankedWins",
        a.ranked_losses AS "rankedLosses",a.ranked_draws AS "rankedDraws",a.current_win_streak AS "currentWinStreak",a.best_win_streak AS "bestWinStreak",
        CASE WHEN a.ranked_matches>0 THEN a.ranked_wins/a.ranked_matches*100 ELSE 0 END AS "winRate",
        COALESCE(last.updated_at,a.updated_at) AS "lastActivity",CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('_id',u.id,'username',u.username,
          'avatarUrl',u.avatar_url,'isBanned',u.is_banned,'isDeleted',u.is_deleted) END AS "user" ${querySql}
        ORDER BY ${order} DESC,a.user_id LIMIT ${query.limit} OFFSET ${(query.page-1)*query.limit}`),
      first(this.db,sql`SELECT COUNT(*)::integer AS count ${querySql}`),
    ]);
    return {items,total:Number(count?.count??0),page:query.page,limit:query.limit};
  }
  async playerDetail(userId:string) {
    const id=this.id(userId);const [user,profile]=await Promise.all([this.users.one(sql`id=${id}::uuid`),this.profiles.one(sql`user_id=${id}::uuid`)]);
    if(!user)throw new NotFoundException('PLAYER_NOT_FOUND');
    const [position,history,ratingHistory]=await Promise.all([this.reads.getLeaderboard(userId,'all',1),
      this.matchList(Object.assign(new ArenaAdminQuery(),{userId,limit:20})),this.ratingHistory(userId,Object.assign(new ArenaAdminQuery(),{limit:100}))]);
    return {user,profile:profile?{...profile,position:position.me?.position??null,winRate:profile.rankedMatches?profile.rankedWins/profile.rankedMatches*100:0}:null,matches:history,ratingHistory};
  }
  async ratingHistory(userId:string,query:ArenaAdminQuery) {
    const where=sql`user_id=${this.id(userId)}::uuid`;
    const [items,total]=await Promise.all([this.ratings.select(where,sql`ORDER BY created_at DESC,id DESC LIMIT ${query.limit} OFFSET ${(query.page-1)*query.limit}`),this.ratings.count(where)]);
    return {items,total,page:query.page,limit:query.limit};
  }
  private async enrichRooms(rooms:any[]) {
    const users=await this.userMap(rooms.flatMap(room=>this.friendRooms.participants(room)));
    return rooms.map(room=>({...room,type:room.maxPlayers>2?'ROOM':'FRIEND',host:users.get(String(room.hostId))??null,
      players:this.friendRooms.participants(room).map(id=>({userId:id,user:users.get(id)??null,isReady:id===String(room.hostId)?true:
        room.maxPlayers>2?room.members.find((m:any)=>String(m.userId)===id)?.isReady:room.guestReady})),
      stale:room.status==='WAITING'&&!!room.updatedAt&&timestamp(room.updatedAt)<Date.now()-1800000}));
  }
  async roomList(query:ArenaRoomQuery) {
    const conditions:Sql[]=[this.dates(query.from,query.to)];
    if(query.type)conditions.push(query.type==='FRIEND'?sql`max_players=2`:sql`max_players>2`);
    if(query.status)conditions.push(sql`status=${query.status}`);
    if(query.mode)conditions.push(sql`mode=${query.mode}`);
    if(query.hostId)conditions.push(sql`host_id=${this.id(query.hostId)}::uuid`);
    if(query.search)conditions.push(sql`code ILIKE '%'||${query.search}||'%'`);
    if(query.stale==='true')conditions.push(sql`status='WAITING' AND updated_at<${new Date(Date.now()-1800000)}`);
    const where=joinSql(conditions,' AND ');
    const [items,total]=await Promise.all([this.rooms.select(where,sql`ORDER BY updated_at DESC,id DESC LIMIT ${query.limit} OFFSET ${(query.page-1)*query.limit}`),this.rooms.count(where)]);
    return {items:await this.enrichRooms(items),total,page:query.page,limit:query.limit};
  }
  async roomDetail(id:string) {
    const room=await this.rooms.one(sql`id=${this.id(id)}::uuid`);if(!room)throw new NotFoundException('ROOM_NOT_FOUND');return (await this.enrichRooms([room]))[0];
  }
  async closeRoom(id: string, adminId: string, reason: string) {
    this.id(id);
    const event = await this.friendRooms.adminCloseWaitingRoom(id);
    if (!event) throw new ConflictException('ROOM_NOT_WAITING');
    await this.logs.log({
      userId: adminId,
      role: 'ADMIN',
      action: 'FORCE_CLOSE_ROOM',
      description: reason,
      metadata: {
        targetType: 'FriendRoom',
        targetId: id,
        roomCode: event.data.code,
        reason } });
    await this.gateway.deliverAdminEvent(event);
    return { closed: true };
  }
  async updateSettings(dto: UpdateArenaSettingsDto, adminId: string) {
    const before = await this.settings.read();
    const result = await this.settings.update(dto);
    await this.logs.log({
      userId: adminId,
      role: 'ADMIN',
      action: 'CHANGE_ARENA_SETTINGS',
      description: dto.reason,
      metadata: {
        targetType: 'ArenaSettings',
        targetId: 'global',
        reason: dto.reason,
        before: before.config,
        after: result.config,
        revision: result.revision } });
    return result;
  }
}
