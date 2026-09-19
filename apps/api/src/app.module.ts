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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const i18nPath = fs.existsSync(path.join(__dirname, 'i18n'))
  ? path.join(__dirname, 'i18n')
  : path.join(process.cwd(), 'src/i18n');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'vi',
      loaderOptions: {
        path: i18nPath,
        watch: true,
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
    VocabularyModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
