import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { I18nService, I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n';
import { RedisIoAdapter } from './common/socket/redis-io.adapter.js';
import { NestExpressApplication } from '@nestjs/platform-express';
import { MediaStorageService } from './common/media/media-storage.service.js';
import { Readable } from 'node:stream';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const i18nService = app.get(I18nService);
  const mediaStorage = app.get(MediaStorageService);
  const PORT = configService.get<number>('PORT') || 5000;

  app.use(json({ limit: '50mb' }))
  app.use(urlencoded({ extended: true, limit: '50mb' }))
  const frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  const adminUrl = configService.get<string>('ADMIN_URL') || 'http://localhost:3001';

  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.enableCors({
    origin: [frontendUrl, adminUrl, 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });

  app.use(cookieParser());
  if (mediaStorage.useObjectStorage()) {
    app.use('/media', async (req: any, res: any, next: any) => {
      if (!['GET', 'HEAD'].includes(req.method)) return next();
      let key: string;
      try { key = mediaStorage.normalizeStorageKey(decodeURIComponent(req.path).replace(/^\//, '')); }
      catch { res.status(400).end(); return; }
      try {
        const upstream = await mediaStorage.streamFromObject(key, req.headers.range);
        if (upstream.status === 404) return next(); // old local media remains accessible
        if (!upstream.ok) return res.status(502).end('Media storage unavailable');
        res.status(upstream.status);
        for (const header of ['content-type','content-length','content-range','accept-ranges','cache-control']) {
          const value = upstream.headers.get(header);
          if (value) res.setHeader(header, value);
        }
        if (req.method === 'HEAD' || !upstream.body) return res.end();
        Readable.fromWeb(upstream.body as any).pipe(res);
      } catch { res.status(502).end('Media storage unavailable'); }
    });
  }
  app.useStaticAssets(mediaStorage.rootPath, { prefix: '/media/' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(
    new HttpExceptionFilter(i18nService),
    new I18nValidationExceptionFilter({
      detailedErrors: false,
      responseBodyFormatter: (host, exc, formattedErrors) => {
        const ctx = host.switchToHttp();
        const request = ctx.getRequest();
        const status = exc.getStatus();

        const message =
          Array.isArray(formattedErrors) && formattedErrors.length === 1
            ? formattedErrors[0]
            : formattedErrors;

        return {
          statusCode: status,
          error: 'Bad Request',
          message,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      },
    }),
  );

  await app.listen(PORT);
}
bootstrap();
