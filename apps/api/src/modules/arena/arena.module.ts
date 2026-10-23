import { ArenaAdminController } from './admin/arena-admin.controller.js';
import { ArenaAdminService } from './admin/arena-admin.service.js';
import { ArenaSettingsService } from './admin/arena-settings.service.js';
import {
  ArenaSettings,
  ArenaSettingsSchema,
} from './admin/arena-settings.schema.js';
import { FriendRoom, FriendRoomSchema } from './schemas/friend-room.schema.js';
import { ArenaFriendRoomService } from './friendly/arena-friend-room.service.js';
import { Module } from '@nestjs/common';
import { ServiceJwtModule } from '../auth/service-jwt.module.js';

import { ArenaGateway } from './gateways/arena.gateway.js';
import { ArenaFriendlyService } from './friendly/arena-friendly.service.js';
import { ArenaMatchmakingService } from './matchmaking/arena-matchmaking.service.js';
import { ArenaPresenceService } from './presence/arena-presence.service.js';
import { ArenaRoomService } from './rooms/arena-room.service.js';
import { ArenaScoringService } from './scoring/arena-scoring.service.js';
import { ArenaMatchService } from './matches/arena-match.service.js';
import { ArenaService } from './arena.service.js';
import { ArenaReadService } from './arena-read.service.js';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ArenaProfile,
  ArenaProfileSchema,
} from './schemas/arena-profile.schema.js';
import {
  ArenaInvitation,
  ArenaInvitationSchema,
} from './schemas/arena-invitation.schema.js';
import { ArenaRoom, ArenaRoomSchema } from './schemas/arena-room.schema.js';
import { ArenaMatch, ArenaMatchSchema } from './schemas/arena-match.schema.js';
import {
  ArenaMatchPlayer,
  ArenaMatchPlayerSchema,
} from './schemas/arena-match-player.schema.js';
import {
  ArenaMatchQuestion,
  ArenaMatchQuestionSchema,
} from './schemas/arena-match-question.schema.js';
import {
  ArenaPlayerAnswer,
  ArenaPlayerAnswerSchema,
} from './schemas/arena-player-answer.schema.js';
import {
  ArenaRatingHistory,
  ArenaRatingHistorySchema,
} from './schemas/arena-rating-history.schema.js';
import { ArenaController } from './arena.controller.js';
import { User, UserSchema } from '../users/schema/user.schema.js';
import { ArenaQuestionService } from './question/arena-question.service.js';
import { ArenaRoundService } from './question/arena-round.service.js';
import { Word, WordSchema } from '../vocabulary/words/word.schema.js';
import { ArenaRatingService } from './rating/arena-rating.service.js';

@Module({
  imports: [
    ServiceJwtModule,
    MongooseModule.forFeature([
      { name: ArenaSettings.name, schema: ArenaSettingsSchema },
      { name: FriendRoom.name, schema: FriendRoomSchema },
      { name: Word.name, schema: WordSchema },
      { name: User.name, schema: UserSchema },
      { name: ArenaProfile.name, schema: ArenaProfileSchema },
      { name: ArenaInvitation.name, schema: ArenaInvitationSchema },
      { name: ArenaRoom.name, schema: ArenaRoomSchema },
      { name: ArenaMatch.name, schema: ArenaMatchSchema },
      { name: ArenaMatchPlayer.name, schema: ArenaMatchPlayerSchema },
      { name: ArenaMatchQuestion.name, schema: ArenaMatchQuestionSchema },
      { name: ArenaPlayerAnswer.name, schema: ArenaPlayerAnswerSchema },
      { name: ArenaRatingHistory.name, schema: ArenaRatingHistorySchema },
    ]),
  ],
  providers: [
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
  ],
})
/** Đăng ký toàn bộ model, service, controller và gateway của Arena. */
export class ArenaModule {}
