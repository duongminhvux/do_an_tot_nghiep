import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { IdentityIntrospectionController } from './identity-introspection.controller.js';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LocalStrategy } from './strategy/local.strategy.js';
import { JwtStrategy } from './strategy/jwt.strategy.js';
import { GoogleStrategy } from './strategy/google.strategy.js';
import { UsersModule } from '../users/users.module.js';
import { AdminsModule } from '../admins/admins.module.js';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Module({
  imports: [
    PassportModule,
    UsersModule,
    AdminsModule,
    JwtModule.register({}),
    PassportModule.register({
      defaultStrategy: 'jwt' }),
  ],
  controllers: [AuthController, AdminAuthController, IdentityIntrospectionController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    // Do not construct passport-google-oauth20 without configured credentials:
    // OAuth2Strategy throws at bootstrap and would take down BOTH admin and
    // password-based login on the identity microservice.
    {
      provide: 'OPTIONAL_GOOGLE_STRATEGY',
      inject: [ConfigService],
      useFactory: (config: ConfigService): GoogleStrategy | null => {
        const clientId = config.get<string>('GOOGLE_CLIENT_ID')?.trim();
        const secret = config.get<string>('GOOGLE_CLIENT_SECRET')?.trim();
        if (!clientId || !secret) return null;
        return new GoogleStrategy(config);
      } },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard },
  ],
  exports: [AuthService] })
export class AuthModule { }
