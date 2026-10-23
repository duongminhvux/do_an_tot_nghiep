import { Controller, DynamicModule, Get, Module, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PgModelsModule } from '../postgres/compat.js';
import { I18nModule, HeaderResolver, AcceptLanguageResolver } from 'nestjs-i18n';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { RedisModule } from '../common/redis/redis.module.js';
import { NotificationClientModule } from '../common/clients/notification-client.js';
import { LearningActivityClientModule } from '../common/clients/learning-activity-client.js';
import { MediaStorageModule } from '../common/media/media-storage.module.js';
import { DomainEventsModule } from '../common/events/domain-events.module.js';
import { JwtModule } from '@nestjs/jwt';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import { ReadModelsModule } from '../internal/read-models.module.js';

export type OwnedService = 'identity'|'content'|'assessment'|'arena'|'learning'|'media-jobs'|'ai-import'|'notification';
export const DATABASE_NAMES:Record<OwnedService,string> = Object.freeze({
  identity:'identity_db',content:'content_db',assessment:'assessment_db',arena:'arena_db',
  learning:'learning_db','media-jobs':'media_db','ai-import':'ai_import_db',notification:'notification_db'
});
export function rootDotenvPath() {
  return [resolve(process.cwd(),'.env'),resolve(process.cwd(),'../../.env')].find(existsSync)
    ?? resolve(process.cwd(),'.env');
}
@Controller('health')
class HealthController {
  @Public() @Get()
  status(){return {status:'ok',service:process.env.SERVICE_ROLE,backend:'postgresql'};}
}
@Module({})
export class PlatformModule {
  static forService(role:OwnedService,business:Type<unknown>[]):DynamicModule{
    const declared=process.env.SERVICE_ROLE;
    if(declared && declared!==role)throw new Error(`Role mismatch ${declared} != ${role}`);
    process.env.SERVICE_ROLE=role;
    const paths=['apps/api/src/i18n','src/i18n','apps/api/dist/i18n'].map(p=>resolve(process.cwd(),p));
    const i18nPath=paths.find(existsSync)??paths[0];
    return {module:PlatformModule,imports:[
      ConfigModule.forRoot({isGlobal:true,envFilePath:[rootDotenvPath()]}),
      I18nModule.forRoot({fallbackLanguage:'vi',loaderOptions:{path:i18nPath,watch:process.env.NODE_ENV!=='production'},
        resolvers:[new HeaderResolver(['x-custom-lang']),AcceptLanguageResolver]}),
      PgModelsModule.forRootAsync(),
      ...(role==='arena'?[RedisModule]:[]),JwtModule.register({}),MediaStorageModule,
      DomainEventsModule,NotificationClientModule,LearningActivityClientModule,ReadModelsModule,...business,
    ],controllers:[HealthController]};
  }
}
