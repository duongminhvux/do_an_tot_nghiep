import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MiniGameResult } from '../schemas/minigame-result.schema.js';
import { MiniGameType } from '../minigame.types.js';
import type { CreateMiniGameResultDto } from '../dto/create-minigame-result.dto.js';
@Injectable()
export class MiniGameResultService {
  constructor(
    @InjectModel(MiniGameResult.name)
    private readonly results: Model<MiniGameResult>,
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
    const result = await this.results.create({
      userId: new Types.ObjectId(userId),
      gameType: dto.gameType,
      score: dto.score,
    });
    return {
      id: String(result._id),
      score: result.score,
      createdAt: result.createdAt,
    };
  }
  async stats(userId: string, value: string) {
    const filter = {
      userId: new Types.ObjectId(userId),
      gameType: this.game(value),
    };
    const [best, recent, totalPlays] = await Promise.all([
      this.results.findOne(filter).sort({ score: -1 }).select('score').lean(),
      this.results
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(10)
        .select('_id score createdAt')
        .lean(),
      this.results.countDocuments(filter),
    ]);
    return {
      bestScore: best?.score ?? 0,
      totalPlays,
      recentScores: recent.map((r) => ({
        id: String(r._id),
        score: r.score,
        createdAt: r.createdAt,
      })),
    };
  }
}
