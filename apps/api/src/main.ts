import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { I18nService, I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const i18nService = app.get(I18nService);
  const PORT = configService.get<number>('PORT') || 5000;

  app.use(json({ limit: '50mb' }))
  app.use(urlencoded({ extended: true, limit: '50mb' }))
  const frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  const adminUrl = configService.get<string>('ADMIN_URL') || 'http://localhost:3001';
  app.enableCors({
    origin: [frontendUrl, adminUrl, 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });

  app.use(cookieParser());
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
