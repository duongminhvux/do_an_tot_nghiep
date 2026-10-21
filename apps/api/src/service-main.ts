import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { I18nService, I18nValidationPipe, I18nValidationExceptionFilter } from 'nestjs-i18n';
import { ServiceRolesModule, type ServiceRole } from './service-roles.module.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { RedisIoAdapter } from './common/socket/redis-io.adapter.js';
import { MediaStorageService } from './common/media/media-storage.service.js';
import { Readable } from 'node:stream';

const role = (process.env.SERVICE_ROLE || 'legacy') as ServiceRole;
const app = await NestFactory.create<NestExpressApplication>(ServiceRolesModule.forRole(role));
const config = app.get(ConfigService);
const i18n = app.get(I18nService);
const media = app.get(MediaStorageService);
const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');

app.use(json({ limit: '50mb' }));
app.use(urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.enableCors({
  origin: [config.get('FRONTEND_URL') || 'http://localhost:3000',
    config.get('ADMIN_URL') || 'http://localhost:3001',
    'http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
});
if (role === 'arena') {
  const adapter = new RedisIoAdapter(app, config);
  await adapter.connectToRedis();
  app.useWebSocketAdapter(adapter);
}
if (role === 'legacy') {
  if (media.useObjectStorage()) {
    app.use('/media', async (req: any, res: any, next: any) => {
      if (!['GET', 'HEAD'].includes(req.method)) return next();
      let key: string;
      try { key = media.normalizeStorageKey(decodeURIComponent(req.path).replace(/^\//, '')); }
      catch { res.status(400).end(); return; }
      try {
        const upstream = await media.streamFromObject(key, req.headers.range);
        if (upstream.status === 404) return next();
        if (!upstream.ok) return res.status(502).end('Media storage unavailable');
        res.status(upstream.status);
        for (const h of ['content-type','content-length','content-range','accept-ranges','cache-control']) {
          const v = upstream.headers.get(h); if (v) res.setHeader(h, v);
        }
        if (req.method === 'HEAD' || !upstream.body) return res.end();
        Readable.fromWeb(upstream.body as any).pipe(res);
      } catch { res.status(502).end('Media storage unavailable'); }
    });
  }
  app.useStaticAssets(media.rootPath, { prefix: '/media/' });
}
app.setGlobalPrefix('api');
app.useGlobalPipes(new I18nValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
app.useGlobalInterceptors(new TransformInterceptor());
app.useGlobalFilters(
  new HttpExceptionFilter(i18n),
  new I18nValidationExceptionFilter({
    detailedErrors: false,
    responseBodyFormatter: (host, exception, errors) => ({
      statusCode: exception.getStatus(),
      error: 'Bad Request',
      message: Array.isArray(errors) && errors.length === 1 ? errors[0] : errors,
      timestamp: new Date().toISOString(),
      path: host.switchToHttp().getRequest().url,
    }),
  }),
);
await app.listen(port, '0.0.0.0');
console.log(`[microservices] ${role} ready on :${port}`);
