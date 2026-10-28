import { Controller,DynamicModule,Get,Module,Optional,ServiceUnavailableException,Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AcceptLanguageResolver,HeaderResolver,I18nModule } from 'nestjs-i18n';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { LearningActivityClientModule } from '../common/clients/learning-activity-client.js';
import { NotificationClientModule } from '../common/clients/notification-client.js';
import { DomainEventsModule } from '../common/events/domain-events.module.js';
import { MediaStorageModule } from '../common/media/media-storage.module.js';
import { MediaStorageService } from '../common/media/media-storage.service.js';
import { RedisModule } from '../common/redis/redis.module.js';
import { RedisService } from '../common/redis/redis.service.js';
import { OwnerReadsModule } from '../internal/owner-reads.module.js';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import { PublicationModule } from '../modules/publication/publication.module.js';
import { InjectPgConnection,PgDatabaseModule,type PgConnection } from '../postgres/connection.js';

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
  constructor(@InjectPgConnection() private readonly connection: PgConnection,
    private readonly media: MediaStorageService,
    @Optional() private readonly redis?: RedisService) {}

  // Liveness is process-only; it must not restart a healthy process because
  // PostgreSQL or RabbitMQ temporarily stopped.
  @Public() @Get()
  status(){return {status:'ok',service:process.env.SERVICE_ROLE,backend:'postgresql'};}

  @Public() @Get('live')
  live(){return this.status();}

  @Public() @Get('ready')
  async ready(){
    const service=process.env.SERVICE_ROLE;
    try {
      await this.connection.query('SELECT 1');
      if(service==='arena') {
        if (!this.redis) throw new Error('Redis dependency not provided');
        await this.redis.getClient().ping();
      }
      if(service==='media-jobs' && !await this.media.objectStoreReady()) {
        throw new Error('S3/media bridge unavailable');
      }
      return {status:'ready',service,dependencies:{postgres:'ok',
        ...(service==='arena'?{redis:'ok'}:{}),
        ...(service==='media-jobs'?{objectStorage:'ok'}:{})}};
    }catch{
      throw new ServiceUnavailableException('Required service dependency unavailable');
    }
  }
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
      PgDatabaseModule.forRootAsync(),
      ...(role==='arena'?[RedisModule]:[]),JwtModule.register({}),MediaStorageModule,
      DomainEventsModule,NotificationClientModule,LearningActivityClientModule,OwnerReadsModule,PublicationModule,...business,
    ],controllers:[HealthController]};
  }
}
