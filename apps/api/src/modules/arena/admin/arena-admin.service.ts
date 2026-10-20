import { ArenaReadService } from '../arena-read.service.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import {
  ArenaMatch,
  ArenaMatchStatus,
  ArenaMatchType,
} from '../schemas/arena-match.schema.js';
import { ArenaMatchPlayer } from '../schemas/arena-match-player.schema.js';
import { ArenaMatchQuestion } from '../schemas/arena-match-question.schema.js';
import { ArenaPlayerAnswer } from '../schemas/arena-player-answer.schema.js';
import { ArenaProfile } from '../schemas/arena-profile.schema.js';
import { ArenaRatingHistory } from '../schemas/arena-rating-history.schema.js';
import { FriendRoomStatus, FriendRoom } from '../schemas/friend-room.schema.js';
import { User } from '../../users/schema/user.schema.js';
import { ArenaPresenceService } from '../presence/arena-presence.service.js';
import { ArenaFriendRoomService } from '../friendly/arena-friend-room.service.js';
import { ArenaGateway } from '../gateways/arena.gateway.js';
import { ActivityLogsService } from '../../activity-logs/activity-logs.service.js';
import { arenaTodayRange } from '../arena.service.js';
import {
  ArenaAdminQuery,
  ArenaDashboardQuery,
  ArenaPlayerQuery,
  ArenaRoomQuery,
  UpdateArenaSettingsDto,
} from './arena-admin.dto.js';
import { ArenaSettingsService } from './arena-settings.service.js';
const escapeRegex = (value: string) =>
  Array.from(value, (char) =>
    '[](){}.*+?^$|\\'.includes(char) ? '\\' + char : char,
  ).join('');
@Injectable()
export class ArenaAdminService {
  constructor(
    @InjectModel(ArenaMatch.name) private readonly matches: Model<ArenaMatch>,
    @InjectModel(ArenaMatchPlayer.name)
    private readonly participants: Model<ArenaMatchPlayer>,
    @InjectModel(ArenaMatchQuestion.name)
    private readonly questions: Model<ArenaMatchQuestion>,
    @InjectModel(ArenaPlayerAnswer.name)
    private readonly answers: Model<ArenaPlayerAnswer>,
    @InjectModel(ArenaProfile.name)
    private readonly profiles: Model<ArenaProfile>,
    @InjectModel(ArenaRatingHistory.name)
    private readonly ratings: Model<ArenaRatingHistory>,
    @InjectModel(FriendRoom.name) private readonly rooms: Model<FriendRoom>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly presence: ArenaPresenceService,
    private readonly friendRooms: ArenaFriendRoomService,
    private readonly gateway: ArenaGateway,
    private readonly settings: ArenaSettingsService,
    private readonly logs: ActivityLogsService,
    private readonly reads: ArenaReadService,
  ) {}
  private id(value: string) {
    if (!/^[a-f\d]{24}$/i.test(value))
      throw new BadRequestException('INVALID_ID');
    return new Types.ObjectId(value);
  }
  private dates(from?: string, to?: string) {
    if (from && to && new Date(from) > new Date(to))
      throw new BadRequestException('INVALID_DATE_RANGE');
    return from || to
      ? {
          createdAt: {
            ...(from ? { $gte: new Date(from) } : {}),
            ...(to ? { $lte: new Date(to) } : {}),
          },
        }
      : {};
  }
  private async userMap(ids: unknown[]) {
    const rows = await this.users
      .find({ _id: { $in: [...new Set(ids.filter(Boolean).map(String))] } })
      .select('_id username email avatarUrl isBanned isDeleted')
      .lean();
    return new Map(rows.map((row) => [String(row._id), row]));
  }
  private async enrichMatches(
    rows: Awaited<ReturnType<ArenaAdminService['rawMatches']>>,
  ) {
    const ids = rows.map((row) => row._id);
    const players = await this.participants
      .find({ matchId: { $in: ids } })
      .select('-scoredQuestionIds')
      .sort({ createdAt: 1, userId: 1 })
      .lean();
    const users = await this.userMap(players.map((p) => p.userId));
    return rows.map((match) => ({
      ...match,
      duration:
        match.startedAt && match.finishedAt
          ? Math.max(
              0,
              Math.round(
                (match.finishedAt.getTime() - match.startedAt.getTime()) / 1000,
              ),
            )
          : null,
      players: players
        .filter((p) => String(p.matchId) === String(match._id))
        .map((p) => {
          const { ratingBefore, ratingAfter, ratingChange, ...rest } = p;
          return {
            ...rest,
            user: users.get(String(p.userId)) ?? null,
            ...(match.type === ArenaMatchType.RANK
              ? { ratingBefore, ratingAfter, ratingChange }
              : {}),
          };
        }),
    }));
  }
  private rawMatches(filter: Record<string, unknown>, skip = 0, limit = 20) {
    return this.matches
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }
  async matchList(query: ArenaAdminQuery) {
    const filter: Record<string, unknown> = {
      ...this.dates(query.from, query.to),
    };
    for (const key of ['type', 'status', 'winnerId', 'finishReason'] as const)
      if (query[key]) filter[key] = query[key];
    if (query.matchId) filter._id = this.id(query.matchId);
    if (query.search) {
      if (!/^[a-f\d]{24}$/i.test(query.search))
        return { items: [], total: 0, page: query.page, limit: query.limit };
      filter._id = this.id(query.search);
    }
    if (query.mode)
      filter.$or = [{ friendMode: query.mode }, { questionMode: query.mode }];
    if (query.userId)
      filter._id = {
        ...(filter._id ? { $eq: filter._id } : {}),
        $in: await this.participants.distinct('matchId', {
          userId: this.id(query.userId),
        }),
      };
    const [rows, total] = await Promise.all([
      this.rawMatches(filter, (query.page - 1) * query.limit, query.limit),
      this.matches.countDocuments(filter),
    ]);
    return {
      items: await this.enrichMatches(rows),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
  async matchDetail(id: string) {
    const match = await this.matches.findById(this.id(id)).lean();
    if (!match) throw new NotFoundException('MATCH_NOT_FOUND');
    const [questionHistory, answerHistory] = await Promise.all([
      this.questions.find({ matchId: match._id }).sort({ order: 1 }).lean(),
      this.answers
        .find({ matchId: match._id })
        .sort({ answeredAt: 1 })
        .limit(10000)
        .lean(),
    ]);
    return {
      ...(await this.enrichMatches([match]))[0],
      questions: questionHistory,
      answers: answerHistory,
    };
  }
  async dashboard(query: ArenaDashboardQuery) {
    const { start, end } = arenaTodayRange();
    const since = new Date(start.getTime() - (query.days - 1) * 86400000);
    const [
      today,
      activeMatches,
      waitingRooms,
      online,
      daily,
      distribution,
      reasons,
      recent,
    ] = await Promise.all([
      this.matches.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end } } },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            cancelled: {
              $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] },
            },
          },
        },
      ]),
      this.matches.countDocuments({
        status: {
          $in: [
            ArenaMatchStatus.COUNTDOWN,
            ArenaMatchStatus.PLAYING,
            ArenaMatchStatus.FINISHING,
          ],
        },
      }),
      this.rooms.countDocuments({ status: FriendRoomStatus.WAITING }),
      this.presence.overview().catch(() => ({ onlineCount: null })),
      this.matches.aggregate([
        { $match: { createdAt: { $gte: since, $lt: end } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'Asia/Ho_Chi_Minh',
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.matches.aggregate([
        { $match: { createdAt: { $gte: since, $lt: end } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      this.matches.aggregate([
        {
          $match: {
            createdAt: { $gte: since, $lt: end },
            status: { $in: ['FINISHED', 'CANCELLED'] },
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$status', 'CANCELLED'] },
                'CANCELLED',
                { $ifNull: ['$finishReason', 'UNKNOWN'] },
              ],
            },
            count: { $sum: 1 },
          },
        },
      ]),
      this.matchList(Object.assign(new ArenaAdminQuery(), { limit: 8 })),
    ]);
    const counts = Object.fromEntries(today.map((row) => [row._id, row.count]));
    return {
      matchesToday: today.reduce((n, row) => n + row.count, 0),
      rankedToday: counts.RANK ?? 0,
      friendlyToday: counts.FRIEND ?? 0,
      groupToday: counts.ROOM ?? 0,
      cancelledToday: today.reduce((n, row) => n + row.cancelled, 0),
      activeMatches,
      waitingRooms,
      onlineArenaUsers: online.onlineCount,
      daily,
      distribution,
      reasons,
      recent: recent.items,
      days: query.days,
    };
  }
  async playerList(query: ArenaPlayerQuery) {
    if (
      query.minRating !== undefined &&
      query.maxRating !== undefined &&
      query.minRating > query.maxRating
    )
      throw new BadRequestException('INVALID_RATING_RANGE');
    const filter: Record<string, unknown> = {};
    if (query.minRating !== undefined || query.maxRating !== undefined)
      filter.rating = {
        ...(query.minRating !== undefined ? { $gte: query.minRating } : {}),
        ...(query.maxRating !== undefined ? { $lte: query.maxRating } : {}),
      };
    if (query.minMatches !== undefined)
      filter.rankedMatches = { $gte: query.minMatches };
    const pipeline: PipelineStage[] = [
      { $match: filter },
      {
        $lookup: {
          from: this.users.collection.name,
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: this.participants.collection.name,
          let: { userId: '$userId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$$userId'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $project: { updatedAt: 1, createdAt: 1 } },
          ],
          as: 'lastMatch',
        },
      },
      {
        $addFields: {
          winRate: {
            $cond: [
              { $gt: ['$rankedMatches', 0] },
              {
                $multiply: [
                  { $divide: ['$rankedWins', '$rankedMatches'] },
                  100,
                ],
              },
              0,
            ],
          },
          lastActivity: {
            $ifNull: [
              { $arrayElemAt: ['$lastMatch.updatedAt', 0] },
              '$updatedAt',
            ],
          },
        },
      },
    ];
    if (query.search) {
      const regex = escapeRegex(query.search);
      pipeline.push({
        $match: {
          $or: [
            { 'user.username': { $regex: regex, $options: 'i' } },
            { 'user.email': { $regex: regex, $options: 'i' } },
            ...(/^[a-f\d]{24}$/i.test(query.search)
              ? [{ userId: this.id(query.search) }]
              : []),
          ],
        },
      });
    }
    if (query.activeSince)
      pipeline.push({
        $match: { lastActivity: { $gte: new Date(query.activeSince) } },
      });
    pipeline.push(
      {
        $project: {
          userId: 1,
          rating: 1,
          rankedMatches: 1,
          rankedWins: 1,
          rankedLosses: 1,
          rankedDraws: 1,
          currentWinStreak: 1,
          bestWinStreak: 1,
          winRate: 1,
          lastActivity: 1,
          'user._id': 1,
          'user.username': 1,
          'user.email': 1,
          'user.avatarUrl': 1,
          'user.isBanned': 1,
          'user.isDeleted': 1,
        },
      },
      {
        $facet: {
          items: [
            { $sort: { [query.sort]: -1, userId: 1 } },
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
          ],
          count: [{ $count: 'total' }],
        },
      },
    );
    const [result] = await this.profiles.aggregate(pipeline);
    return {
      items: result?.items ?? [],
      total: result?.count?.[0]?.total ?? 0,
      page: query.page,
      limit: query.limit,
    };
  }
  async playerDetail(userId: string) {
    const id = this.id(userId);
    const [user, profile] = await Promise.all([
      this.users
        .findById(id)
        .select('_id username email avatarUrl isBanned isDeleted')
        .lean(),
      this.profiles.findOne({ userId: id }).lean(),
    ]);
    if (!user) throw new NotFoundException('PLAYER_NOT_FOUND');
    const [position, history, ratingHistory] = await Promise.all([
      this.reads.getLeaderboard(userId, 'all', 1),
      this.matchList(
        Object.assign(new ArenaAdminQuery(), { userId, limit: 20 }),
      ),
      this.ratingHistory(
        userId,
        Object.assign(new ArenaAdminQuery(), { limit: 100 }),
      ),
    ]);
    return {
      user,
      profile: profile
        ? {
            ...profile,
            position: position.me?.position ?? null,
            winRate: profile.rankedMatches
              ? (profile.rankedWins / profile.rankedMatches) * 100
              : 0,
          }
        : null,
      matches: history,
      ratingHistory,
    };
  }
  async ratingHistory(userId: string, query: ArenaAdminQuery) {
    const filter = { userId: this.id(userId) };
    const [items, total] = await Promise.all([
      this.ratings
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.ratings.countDocuments(filter),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }
  private async enrichRooms(
    rows: (FriendRoom & {
      _id: Types.ObjectId;
      createdAt?: Date;
      updatedAt?: Date;
    })[],
  ) {
    const users = await this.userMap(
      rows.flatMap((room) => this.friendRooms.participants(room)),
    );
    return rows.map((room) => ({
      ...room,
      type: room.maxPlayers > 2 ? 'ROOM' : 'FRIEND',
      host: users.get(String(room.hostId)) ?? null,
      players: this.friendRooms.participants(room).map((id) => ({
        userId: id,
        user: users.get(id) ?? null,
        isReady:
          id === String(room.hostId)
            ? true
            : room.maxPlayers > 2
              ? room.members.find((m) => String(m.userId) === id)?.isReady
              : room.guestReady,
      })),
      stale:
        room.status === 'WAITING' &&
        !!room.updatedAt &&
        room.updatedAt.getTime() < Date.now() - 1800000,
    }));
  }
  async roomList(query: ArenaRoomQuery) {
    const filter: Record<string, unknown> = {
      ...this.dates(query.from, query.to),
    };
    if (query.type)
      filter.maxPlayers = query.type === 'FRIEND' ? 2 : { $gt: 2 };
    if (query.status) filter.status = query.status;
    if (query.mode) filter.mode = query.mode;
    if (query.hostId) filter.hostId = this.id(query.hostId);
    if (query.search)
      filter.code = { $regex: escapeRegex(query.search), $options: 'i' };
    if (query.stale === 'true') {
      filter.status = 'WAITING';
      filter.updatedAt = { $lt: new Date(Date.now() - 1800000) };
    }
    const [items, total] = await Promise.all([
      this.rooms
        .find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.rooms.countDocuments(filter),
    ]);
    return {
      items: await this.enrichRooms(items),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
  async roomDetail(id: string) {
    const room = await this.rooms.findById(this.id(id)).lean();
    if (!room) throw new NotFoundException('ROOM_NOT_FOUND');
    return (await this.enrichRooms([room]))[0];
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
        reason,
      },
    });
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
        revision: result.revision,
      },
    });
    return result;
  }
}
