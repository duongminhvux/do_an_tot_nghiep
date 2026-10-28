import type { Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json,urlencoded } from 'express';
import { I18nService,I18nValidationExceptionFilter,I18nValidationPipe } from 'nestjs-i18n';
import { Readable } from 'node:stream';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter.js';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor.js';
import { MediaStorageService } from '../common/media/media-storage.service.js';
import { RedisIoAdapter } from '../common/socket/redis-io.adapter.js';
import { refreshCookieOptions } from '../modules/auth/refresh-cookie.js';
import { learnerPublicationRequest } from '../modules/publication/publication-scope.js';
import { getConnectionToken,type PgConnection } from '../postgres/connection.js';
import { assertSchemaReady } from '../postgres/migrations.js';
import { httpPolicy } from './http-policy.js';
import { DATABASE_NAMES,PlatformModule,type OwnedService } from './platform.module.js';

export async function bootstrapService(role:OwnedService,modules:Type<unknown>[]){
  const app=await NestFactory.create<NestExpressApplication>(PlatformModule.forService(role,modules));
  const config=app.get(ConfigService),i18n=app.get(I18nService),media=app.get(MediaStorageService);
  const port=Number(process.env.PORT||5000);
  if(!Number.isInteger(port)||port<=0||port>65535)throw new Error('Invalid PORT');
  app.use(json({limit:'50mb'}));app.use(urlencoded({extended:true,limit:'50mb'}));app.use(cookieParser());
  app.use(learnerPublicationRequest);
  const policy = httpPolicy(config);
  app.set('trust proxy', policy.trustProxy);
  if (role === 'identity') {
    refreshCookieOptions(config, 'user');
    refreshCookieOptions(config, 'admin');
  }
  app.use((req: any, res: any, next: () => void) => {
    if (!policy.allowsOrigin(req.headers.origin)) {
      return res.status(403).json({ statusCode: 403, message: 'Origin is not allowed' });
    }
    if (/^\/api\/(?:admin\/)?auth(?:\/|$)/.test(req.path)) {
      res.setHeader('Cache-Control', 'private, no-store');
    }
    next();
  });
  app.enableCors({origin: policy.origins, credentials: true});
  if(role==='arena'){const adapter=new RedisIoAdapter(app,config);await adapter.connectToRedis();app.useWebSocketAdapter(adapter);}
  if(role==='media-jobs'){
    if(!media.useObjectStorage())throw new Error('MEDIA_STORAGE_BACKEND=s3 required');
    app.use('/media',async(req:any,res:any,next:any)=>{
      if(!['GET','HEAD'].includes(req.method))return next();
      let key:string;try{key=media.normalizeStorageKey(decodeURIComponent(req.path).replace(/^\//,''));}catch{res.status(400).end();return;}
      // Source recordings and private objects must never be served by a public
      // predictable /media URL. Internal workers fetch them from S3 directly.
      if (/^(?:asr-jobs|private)\//.test(key)) return res.status(403).end();
      try{const response=await media.streamFromObject(key,req.headers.range);
        if(response.status===404)return res.status(404).end();
        if(!response.ok)return res.status(502).end('Media unavailable');
        res.status(response.status);
        for(const h of ['content-type','content-length','content-range','accept-ranges','cache-control']){
          const v=response.headers.get(h);if(v)res.setHeader(h,v);
        }
        if(req.method==='HEAD'){
          await response.body?.cancel();
          return res.end();
        }
        if(!response.body)return res.end();
        Readable.fromWeb(response.body as any).pipe(res);
      }catch{res.status(502).end('Media unavailable');}
    });
  }
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new I18nValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter(i18n),new I18nValidationExceptionFilter({detailedErrors:false,
    responseBodyFormatter:(host,exception,errors)=>({statusCode:exception.getStatus(),error:'Bad Request',
      message:Array.isArray(errors)&&errors.length===1?errors[0]:errors,
      timestamp:new Date().toISOString(),path:host.switchToHttp().getRequest().url})}));
  await app.init();
  const conn=app.get<PgConnection>(getConnectionToken());
  const r=await conn.query('SELECT current_database() AS database_name, current_user AS owner');
  if(r.rows[0]?.database_name!==DATABASE_NAMES[role])throw new Error(`DB ownership violation for ${role}: ${r.rows[0]?.database_name}`);
  await assertSchemaReady(conn.pool,role);
  await app.listen(port,'0.0.0.0');
  console.log(`[service] ${role} ready on ${port} postgres=${r.rows[0].database_name}`);
  return app;
}
