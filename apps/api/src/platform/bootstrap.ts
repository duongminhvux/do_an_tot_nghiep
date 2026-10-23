import { NestFactory } from '@nestjs/core';
import { Type } from '@nestjs/common';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { I18nService, I18nValidationPipe, I18nValidationExceptionFilter } from 'nestjs-i18n';
import { getConnectionToken } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import type { Connection } from 'mongoose';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { PlatformModule, type OwnedService, DATABASE_NAMES } from './platform.module.js';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter.js';
import { RedisIoAdapter } from '../common/socket/redis-io.adapter.js';
import { MediaStorageService } from '../common/media/media-storage.service.js';
import type { DatabaseVersionDocument } from './database-documents.js';

/** Fresh schema is initialized automatically by db-init before service startup. */
export async function assertDatabaseInitialized(role: OwnedService):Promise<void> {
  const uri=process.env.MONGO_URI;
  if(!uri) throw new Error('MONGO_URI is required');
  const manifest=readFileSync(resolve(process.cwd(),'database/schema/collections.json'));
  const checksum=createHash('sha256').update(manifest).digest('hex');
  const conn=await mongoose.createConnection(uri,{dbName:DATABASE_NAMES[role],autoIndex:false,
    serverSelectionTimeoutMS:10000}).asPromise();
  try {
    const db=conn.db;
    if(!db || db.databaseName!==DATABASE_NAMES[role]) throw new Error('Wrong Mongo database');
    const marker=await db.collection<DatabaseVersionDocument>('database_versions').findOne({_id:'schema_manifest_current'});
    if(!marker || marker.role!==role || marker.schemaVersion!==JSON.parse(manifest.toString('utf8')).schemaVersion || marker.schemaChecksum!==checksum) {
      throw new Error(`Database schema not reconciled for ${role}; inspect db-init container logs.`);
    }
  } finally { await conn.close(); }
}

/** One process = one service = one owned MongoDB database. */
export async function bootstrapService(role:OwnedService, modules:Type<unknown>[]) {
  await assertDatabaseInitialized(role);
  const app=await NestFactory.create<NestExpressApplication>(PlatformModule.forService(role,modules));
  const config=app.get(ConfigService);
  const i18n=app.get(I18nService);
  const media=app.get(MediaStorageService);
  const port=Number(process.env.PORT||5000);
  if (!Number.isInteger(port)||port<1||port>65535) throw new Error('Invalid PORT');
  app.use(json({limit:'50mb'}));
  app.use(urlencoded({extended:true,limit:'50mb'}));
  app.use(cookieParser());
  app.enableCors({origin:[config.get('FRONTEND_URL')||'http://localhost:3000',
      config.get('ADMIN_URL')||'http://localhost:3001'],credentials:true});
  if(role==='arena') {
    const adapter=new RedisIoAdapter(app,config);
    await adapter.connectToRedis();
    app.useWebSocketAdapter(adapter);
  }
  if(role==='media-jobs') {
    if (!media.useObjectStorage()) throw new Error('MEDIA_STORAGE_BACKEND=s3 required');
    app.use('/media',async(req:any,res:any,next:any)=>{
      if(!['GET','HEAD'].includes(req.method)) return next();
      let key:string;
      try {key=media.normalizeStorageKey(decodeURIComponent(req.path).replace(/^\//,''));}
      catch{res.status(400).end();return;}
      try{
        const response=await media.streamFromObject(key,req.headers.range);
        if(response.status===404) return res.status(404).end();
        if(!response.ok) return res.status(502).end('Media unavailable');
        res.status(response.status);
        for(const h of ['content-type','content-length','content-range','accept-ranges','cache-control']) {
          const val=response.headers.get(h);if(val)res.setHeader(h,val);
        }
        if(req.method==='HEAD'||!response.body)return res.end();
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
  // Connect only to this service database and verify its initialized schema.
  await app.init();
  const db=app.get<Connection>(getConnectionToken()).db;
  if(!db || db.databaseName!==DATABASE_NAMES[role]) throw new Error('Service MongoDB ownership violation');
  const marker=await db.collection<DatabaseVersionDocument>('database_versions').findOne({_id:'schema_manifest_current'});
  const manifest=readFileSync(resolve(process.cwd(),'database/schema/collections.json'));
  const manifestChecksum=createHash('sha256').update(manifest).digest('hex');
  if(!marker || marker.schemaVersion!==JSON.parse(manifest.toString('utf8')).schemaVersion || marker.role!==role || marker.schemaChecksum!==manifestChecksum) {
    throw new Error(`Service ${role} requires db-init schema_manifest_current`);
  }
  await app.listen(port,'0.0.0.0');
  console.log(`[service] ${role} ready on ${port} database=${DATABASE_NAMES[role]}`);
  return app;
}
