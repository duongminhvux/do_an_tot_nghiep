import { Injectable } from '@nestjs/common';
import { ArenaPresenceService } from './presence/arena-presence.service.js';
import { ArenaMatchmakingService } from './matchmaking/arena-matchmaking.service.js';
import { ArenaScoringService } from './scoring/arena-scoring.service.js';
import { ArenaMatchService } from './matches/arena-match.service.js';
import { ArenaRoomService } from './rooms/arena-room.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { ArenaProfile } from './schemas/arena-profile.schema.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ArenaService {
  constructor(
    private readonly arenaMatchmakingService: ArenaMatchmakingService,
    private readonly arenaPresenceService: ArenaPresenceService,
    private readonly arenaRoomService: ArenaRoomService,
    private readonly arenaMatchService: ArenaMatchService,
    private readonly arenaScoringService: ArenaScoringService,
    private readonly redisService: RedisService,
    @InjectModel(ArenaProfile.name)
    private readonly arenaProfileModel: Model<ArenaProfile>,
  ) {}

  async getOrCreate(userId: string) {
    return this.arenaProfileModel.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  }
}
