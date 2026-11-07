import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import request from 'supertest';
import { AdminAuthController } from './admin-auth.controller.js';
import { AuthService } from './auth.service.js';
import { AdminsService } from '../admins/admins.service.js';
import { ServiceJwtStrategy } from './service-jwt.module.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

describe('admin password HTTP self-service', () => {
  let app: INestApplication;
  const jwt = new JwtService(),
    secret = 'admin-password-http-fixture';
  const actor = '10000000-0000-4000-8000-000000000001';
  const change = vi.fn(async () => ({ changed: true }));
  const token = async (role = 'ADMIN') =>
    `Bearer ${await jwt.signAsync({ _id: actor, role }, { secret })}`;
  beforeAll(async () => {
    const config = new ConfigService({
      JWT_ACCESS_SECRET: secret,
      COOKIE_SECURE: 'false',
    });
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [AdminAuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: AdminsService, useValue: { changeOwnPassword: change } },
        { provide: ConfigService, useValue: config },
        { provide: I18nService, useValue: {} },
        { provide: JwtService, useValue: jwt },
        {
          provide: ServiceJwtStrategy,
          useValue: new ServiceJwtStrategy(config, {
            verifyToken: async (raw: string) => ({
              ...(await jwt.verifyAsync(raw, { secret })),
              status: 'ACTIVE',
              authVersion: 4,
              permissions: [],
            }),
          } as never),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    const reflector = new Reflector();
    app.useGlobalGuards(
      new JwtAuthGuard(reflector),
      new PermissionsGuard(reflector),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => app.close());
  const body = {
    oldPassword: 'CurrentPassword123',
    newPassword: 'ReplacementPassword456',
  };
  it('requires an authenticated administrator', async () => {
    await request(app.getHttpServer())
      .post('/admin/auth/change-password')
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .post('/admin/auth/change-password')
      .set('Authorization', await token('USER'))
      .send(body)
      .expect(403);
    expect(change).not.toHaveBeenCalled();
  });
  it('rejects missing/weak fields and attempts to choose another account', async () => {
    for (const invalid of [
      {},
      { ...body, newPassword: 'short' },
      { ...body, adminId: actor },
    ]) {
      await request(app.getHttpServer())
        .post('/admin/auth/change-password')
        .set('Authorization', await token())
        .send(invalid)
        .expect(400);
    }
    expect(change).not.toHaveBeenCalled();
  });
  it('uses the verified principal, works without management permissions and clears the admin refresh cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/auth/change-password')
      .set('Authorization', await token())
      .send(body)
      .expect(201);
    expect(change).toHaveBeenCalledWith(
      expect.objectContaining({ _id: actor, authVersion: 4 }),
      body.oldPassword,
      body.newPassword,
    );
    expect(response.body).toEqual({ changed: true });
    expect(String(response.headers['set-cookie'])).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
  });
});
