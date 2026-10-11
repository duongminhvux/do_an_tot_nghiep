import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';

import { ArenaGateway } from './gateways/arena.gateway.js';
import { ArenaMatchmakingService } from './matchmaking/arena-matchmaking.service.js';
import { ArenaPresenceService } from './presence/arena-presence.service.js';
import { ArenaRoomService } from './rooms/arena-room.service.js';
import { ArenaScoringService } from './scoring/arena-scoring.service.js';
import { ArenaMatchService } from './matches/arena-match.service.js';
import { ArenaService } from './arena.service.js';
import { MongooseModule } from '@nestjs/mongoose';
import { ArenaProfile, ArenaProfileSchema } from './schemas/arena-profile.schema.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: ArenaProfile.name, schema: ArenaProfileSchema },
      // { name: ArenaMatch.name, schema: ArenaMatchSchema },
    ]),
  ],
  providers: [
    ArenaGateway,
    ArenaMatchmakingService,
    ArenaRoomService,
    ArenaMatchService,
    ArenaPresenceService,
    ArenaScoringService,
    ArenaService,
  ],
  exports: [
    ArenaMatchmakingService,
    ArenaRoomService,
    ArenaMatchService,
    ArenaPresenceService,
    ArenaScoringService,
  ],
})
export class ArenaModule {}
