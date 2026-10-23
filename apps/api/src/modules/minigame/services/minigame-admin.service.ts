import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type Model, type PipelineStage, Types } from 'mongoose';
import { MiniGameResult } from '../schemas/minigame-result.schema.js';
import { MiniGameType } from '../minigame.types.js';
import {
  MiniGameResultQueryDto,
  TopScoresQueryDto,
} from '../dto/minigame-result-query.dto.js';

type ResultFilter = {
  gameType?: MiniGameType;
  userId?: Types.ObjectId;
  score?: { $gte?: number; $lte?: number };
  createdAt?: { $gte?: Date; $lt?: Date };
};

@Injectable()
export class MiniGameAdminService {
  constructor(
    @InjectModel(MiniGameResult.name)
    private readonly results: Model<MiniGameResult>,
  ) {}

  private dateFilter(query: MiniGameResultQueryDto): ResultFilter {
    const filter: ResultFilter = {};
    if (query.gameType) filter.gameType = query.gameType;
    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query.minScore !== undefined || query.maxScore !== undefined) {
      filter.score = {};
      if (query.minScore !== undefined) filter.score.$gte = query.minScore;
      if (query.maxScore !== undefined) filter.score.$lte = query.maxScore;
    }
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(query.from);
      if (query.to) {
        const end = new Date(query.to);
        end.setUTCDate(end.getUTCDate() + 1);
        filter.createdAt.$lt = end;
      }
    }
    return filter;
  }

  private sort(sort: MiniGameResultQueryDto['sort']) {
    const sorts: Record<
      NonNullable<MiniGameResultQueryDto['sort']>,
      Record<string, 1 | -1>
    > = {
      score_desc: { score: -1, createdAt: -1 },
      score_asc: { score: 1, createdAt: -1 },
      newest: { createdAt: -1, _id: -1 },
      oldest: { createdAt: 1, _id: 1 },
    };
    return sorts[sort ?? 'newest'];
  }

  async list(query: MiniGameResultQueryDto) {
    if (
      query.minScore !== undefined &&
      query.maxScore !== undefined &&
      query.minScore > query.maxScore
    )
      throw new BadRequestException('MIN_SCORE_GREATER_THAN_MAX_SCORE');

    const filter = this.dateFilter(query);
    const pipeline: PipelineStage[] = [{ $match: filter }];
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    );
    if (query.search) {
      const search = new RegExp(
        query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      const searchClauses: Record<string, unknown>[] = [
        { 'user.username': search },
        { 'user.email': search },
      ];
      if (query.search.match(/^[a-f\d]{24}$/i))
        searchClauses.push({ userId: new Types.ObjectId(query.search) });
      pipeline.push({
        $match: {
          $or: searchClauses,
        },
      });
    }
    pipeline.push(
      { $sort: this.sort(query.sort) },
      {
        $facet: {
          items: [
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
            {
              $project: {
                _id: 1,
                userId: 1,
                gameType: 1,
                score: 1,
                createdAt: 1,
                player: {
                  username: '$user.username',
                  email: '$user.email',
                },
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    );
    const [result] = await this.results.aggregate(pipeline);
    return {
      items: result?.items ?? [],
      page: query.page,
      limit: query.limit,
      total: result?.total?.[0]?.count ?? 0,
    };
  }

  async statistics() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [summary, games, daily, bestScores] = await Promise.all([
      this.results.aggregate([
        {
          $facet: {
            totalPlays: [{ $count: 'value' }],
            playsToday: [
              { $match: { createdAt: { $gte: today } } },
              { $count: 'value' },
            ],
            uniquePlayers: [
              { $group: { _id: '$userId' } },
              { $count: 'value' },
            ],
            mostPlayed: [
              { $group: { _id: '$gameType', plays: { $sum: 1 } } },
              { $sort: { plays: -1 } },
              { $limit: 1 },
            ],
          },
        },
      ]),
      this.results.aggregate([
        {
          $group: {
            _id: '$gameType',
            plays: { $sum: 1 },
            users: { $addToSet: '$userId' },
            bestScore: { $max: '$score' },
          },
        },
        {
          $project: {
            _id: 0,
            gameType: '$_id',
            plays: 1,
            uniquePlayers: { $size: '$users' },
            bestScore: 1,
          },
        },
        { $sort: { plays: -1 } },
      ]),
      this.results.aggregate([
        {
          $match: { createdAt: { $gte: new Date(Date.now() - 90 * 86400000) } },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            plays: { $sum: 1 },
          },
        },
        { $project: { _id: 0, date: '$_id', plays: 1 } },
        { $sort: { date: 1 } },
      ]),
      this.results.aggregate([
        { $sort: { score: -1, createdAt: 1 } },
        {
          $group: {
            _id: '$gameType',
            score: { $first: '$score' },
            userId: { $first: '$userId' },
            createdAt: { $first: '$createdAt' },
          },
        },
        {
          $project: {
            _id: 0,
            gameType: '$_id',
            score: 1,
            userId: 1,
            createdAt: 1,
          },
        },
      ]),
    ]);
    const data = summary[0] ?? {};
    return {
      totalPlays: data.totalPlays?.[0]?.value ?? 0,
      playsToday: data.playsToday?.[0]?.value ?? 0,
      uniquePlayers: data.uniquePlayers?.[0]?.value ?? 0,
      mostPlayedGame: data.mostPlayed?.[0]
        ? {
            gameType: data.mostPlayed[0]._id,
            plays: data.mostPlayed[0].plays,
          }
        : null,
      games,
      playsByDay: daily,
      bestScores,
    };
  }

  topScores(gameType: string, query: TopScoresQueryDto) {
    if (!Object.values(MiniGameType).includes(gameType as MiniGameType))
      throw new BadRequestException('MINIGAME_UNSUPPORTED');
    return this.results.aggregate([
      { $match: { gameType } },
      { $sort: { score: -1, createdAt: 1 } },
      {
        $group: {
          _id: '$userId',
          score: { $first: '$score' },
          createdAt: { $first: '$createdAt' },
        },
      },
      { $sort: { score: -1, createdAt: 1 } },
      { $limit: query.limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          score: 1,
          createdAt: 1,
          player: { username: '$user.username', email: '$user.email' },
        },
      },
    ]);
  }
}
