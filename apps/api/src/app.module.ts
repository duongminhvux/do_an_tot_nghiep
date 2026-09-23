import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './modules/users/users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { GmailModule } from './modules/gmail/gmail.module.js';
import { HeaderResolver, I18nModule, AcceptLanguageResolver } from 'nestjs-i18n';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module.js';
import { AdminsModule } from './modules/admins/admins.module.js';
import { UploadModule } from './modules/upload/upload.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prioritize source directory so Nest compiler clearing dist during watch mode never triggers ENOENT
const candidatePaths = [
  path.resolve(__dirname, '../src/i18n'),
  path.resolve(process.cwd(), 'src/i18n'),
  path.resolve(process.cwd(), 'apps/api/src/i18n'),
  path.join(__dirname, 'i18n'),
];
const i18nPath = candidatePaths.find((p) => fs.existsSync(p)) || path.join(__dirname, 'i18n');
const isDev = process.env.NODE_ENV !== 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'vi',
      loaderOptions: {
        path: i18nPath,
        watch: isDev,
      },
      resolvers: [
        new HeaderResolver(['x-custom-lang']),
        AcceptLanguageResolver,
      ],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGO_URI') ??
          'mongodb://127.0.0.1:27017/english-platform',
      }),
    }),
    UsersModule,
    AdminsModule,
    AuthModule,
    GmailModule,
    VocabularyModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
