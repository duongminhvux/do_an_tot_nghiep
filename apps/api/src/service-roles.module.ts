import { Controller, Get, Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { I18nModule, HeaderResolver, AcceptLanguageResolver } from 'nestjs-i18n';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuthModule } from './modules/auth/auth.module.js';
import { AppModule } from './app.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AdminsModule } from './modules/admins/admins.module.js';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module.js';
import { DictationModule } from './modules/dictation/dictation.module.js';
import { UploadModule } from './modules/upload/upload.module.js';
import { AssessmentModule } from './modules/assessment/assessment.module.js';
import { AiImportModule } from './modules/assessment/ai-import.module.js';
import { ArenaModule } from './modules/arena/arena.module.js';
import { LearningModule } from './modules/learning/learning.module.js';
import { MiniGameModule } from './modules/minigame/minigame.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module.js';
import { GmailModule } from './modules/gmail/gmail.module.js';
import { AudioProcessingModule } from './modules/audio-processing/audio-processing.module.js';
import { AsrModule } from './modules/asr/asr.module.js';
import { TtsModule } from './modules/tts/tts.module.js';
import { MediaStorageModule } from './common/media/media-storage.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { ServiceJwtModule } from './modules/auth/service-jwt.module.js';
import { JwtModule } from '@nestjs/jwt';
import { Public } from './modules/auth/decorators/public.decorator.js';
import { IdentityIntrospectionController } from './modules/auth/identity-introspection.controller.js';
import { DomainEventsModule } from './common/events/domain-events.module.js';

export type ServiceRole = 'legacy' | 'identity' | 'content' | 'assessment'
  | 'arena' | 'learning' | 'media-jobs' | 'ai-import' | 'notification';

const roles: Record<ServiceRole, any[]> = {
  legacy: [AppModule], // route fallback for endpoints not migrated to new services
  identity: [AuthModule, UsersModule, AdminsModule],
  content: [ServiceJwtModule, VocabularyModule, DictationModule, UploadModule],
  assessment: [ServiceJwtModule, AssessmentModule],
  arena: [ArenaModule], // Arena imports thin ServiceJwtModule.
  learning: [ServiceJwtModule, LearningModule, MiniGameModule, DashboardModule],
  'media-jobs': [ServiceJwtModule, AudioProcessingModule, AsrModule, TtsModule],
  'ai-import': [ServiceJwtModule, AiImportModule],
  notification: [ServiceJwtModule, GmailModule, ActivityLogsModule],
};

@Controller('health')
export class RoleHealthController {
  @Public()
  @Get()
  status() { return { status: 'ok', role: process.env.SERVICE_ROLE || 'legacy' }; }
}

@Module({})
export class ServiceRolesModule {
  static forRole(role: ServiceRole): DynamicModule {
    if (!Object.prototype.hasOwnProperty.call(roles, role)) throw new Error(`Invalid SERVICE_ROLE: ${role}`);
    const paths = ['apps/api/src/i18n', 'src/i18n', 'apps/api/dist/i18n']
      .map(p => resolve(process.cwd(), p));
    const i18nPath = paths.find(existsSync) ?? paths[0];
    return {
      module: ServiceRolesModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['../../.env', '.env'],
        }),
        I18nModule.forRoot({
          fallbackLanguage: 'vi',
          loaderOptions: { path: i18nPath, watch: process.env.NODE_ENV !== 'production' },
          resolvers: [new HeaderResolver(['x-custom-lang']), AcceptLanguageResolver],
        }),
        MongooseModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            uri: config.get<string>('MONGO_URI') ?? 'mongodb://mongo:27017/english-platform',
            autoIndex: false, // schema changes only through the deployment migrator
          }),
        }),
        RedisModule,
        JwtModule.register({}),
        MediaStorageModule,
        DomainEventsModule,
        ...roles[role],
      ],
      controllers: [RoleHealthController, ...(role === 'identity' ? [IdentityIntrospectionController] : [])],
    };
  }
}
