import { ArenaAdminController } from './admin/arena-admin.controller.js';
import { ArenaAdminService } from './admin/arena-admin.service.js';
import { ArenaSettingsService } from './admin/arena-settings.service.js';


import { Module } from '@nestjs/common';
import { ServiceJwtModule } from '../auth/service-jwt.module.js';
import { ArenaFriendRoomService } from './friendly/arena-friend-room.service.js';

import { ArenaReadService } from './arena-read.service.js';
import { ArenaService } from './arena.service.js';
import { ArenaFriendlyService } from './friendly/arena-friendly.service.js';
import { ArenaGateway } from './gateways/arena.gateway.js';
import { ArenaMatchService } from './matches/arena-match.service.js';
import { ArenaMatchmakingService } from './matchmaking/arena-matchmaking.service.js';
import { ArenaPresenceService } from './presence/arena-presence.service.js';
import { ArenaRoomService } from './rooms/arena-room.service.js';
import { ArenaScoringService } from './scoring/arena-scoring.service.js';









import { ArenaController } from './arena.controller.js';

import { ArenaQuestionService } from './question/arena-question.service.js';
import { ArenaRoundService } from './question/arena-round.service.js';

import { ArenaMatchTransactions } from './matches/arena-match-transactions.js';
import { ArenaRankedConnectionService } from './matches/arena-ranked-connection.service.js';
import { ArenaRatingService } from './rating/arena-rating.service.js';

@Module({
  imports: [ServiceJwtModule],
  providers: [
    ArenaMatchTransactions,
    ArenaRankedConnectionService,
    ArenaSettingsService,
    ArenaAdminService,
    ArenaFriendRoomService,
    ArenaFriendlyService,
    ArenaGateway,
    ArenaMatchmakingService,
    ArenaRoomService,
    ArenaMatchService,
    ArenaPresenceService,
    ArenaScoringService,
    ArenaService,
    ArenaReadService,
    ArenaQuestionService,
    ArenaRoundService,
    ArenaRatingService,
  ],
  controllers: [ArenaController, ArenaAdminController],
  exports: [
    ArenaMatchmakingService,
    ArenaRoomService,
    ArenaMatchService,
    ArenaPresenceService,
    ArenaScoringService,
  ] })
/** Đăng ký toàn bộ model, service, controller và gateway của Arena. */
export class ArenaModule {}
