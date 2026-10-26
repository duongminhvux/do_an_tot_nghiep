import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RecommendationsController } from './recommendations.controller.js';
import { RecommendationsService } from './recommendations.service.js';
import { AdminSiteSettingsController } from '../../site-settings/site-settings.controller.js';
import { SiteSettingsService } from '../../site-settings/site-settings.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { ServiceJwtStrategy } from '../../auth/service-jwt.module.js';
import { DEFAULT_RECOMMENDATION_RULES } from '@repo/shared-types/recommendations';

describe('F01 HTTP authentication and owner isolation', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const secret = 'f01-http-test-secret';
  const userA = '10000000-0000-4000-8000-000000000001';
  const userB = '10000000-0000-4000-8000-000000000002';
  const list = vi.fn(async () => ({ state: 'insufficient_data', items: [] }));
  const readRecommendations = vi.fn(async () => DEFAULT_RECOMMENDATION_RULES);
  const token = (id: string, role = 'USER') =>
    jwt.signAsync({ _id: id, role }, { secret, expiresIn: '5m' });
  beforeAll(async () => {
    const reflector = new Reflector();
    // JWT signatures and the production JWT/Roles guards run here. Only Identity's
    // account-introspection boundary and business data are test doubles.
    const strategy = new ServiceJwtStrategy(
      new ConfigService({ JWT_ACCESS_SECRET: secret }),
      {
        verifyToken: async (raw: string) => jwt.verifyAsync(raw, { secret }),
      } as never,
    );
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [RecommendationsController, AdminSiteSettingsController],
      providers: [
        { provide: ServiceJwtStrategy, useValue: strategy },
        { provide: RolesGuard, useValue: new RolesGuard(reflector) },
        { provide: RecommendationsService, useValue: { list } },
        { provide: SiteSettingsService, useValue: { readRecommendations } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalGuards(new JwtAuthGuard(reflector));
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('returns 401 for missing, malformed, expired or incorrectly signed JWTs', async () => {
    for (const value of [
      '',
      'bad.jwt',
      await jwt.signAsync(
        { _id: userA, role: 'USER' },
        { secret, expiresIn: -1 },
      ),
      await jwt.signAsync({ _id: userA }, { secret: 'wrong-secret' }),
    ]) {
      await request(app.getHttpServer())
        .get('/api/learning/recommendations')
        .set('Authorization', `Bearer ${value}`)
        .expect(401);
    }
    expect(list).not.toHaveBeenCalled();
  });
  it('uses each signed-in user identity and marks personal responses as non-cacheable', async () => {
    for (const id of [userA, userB]) {
      const response = await request(app.getHttpServer())
        .get('/api/learning/recommendations?lang=en')
        .set('Authorization', `Bearer ${await token(id)}`)
        .expect(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(list).toHaveBeenLastCalledWith(id, 'en');
    }
  });
  it('returns 403 for learners on config read/write and simulation routes', async () => {
    const auth = `Bearer ${await token(userA)}`;
    await request(app.getHttpServer())
      .get('/api/admin/site-settings/recommendations')
      .set('Authorization', auth)
      .expect(403);
    await request(app.getHttpServer())
      .put('/api/admin/site-settings/recommendations')
      .set('Authorization', auth)
      .send(DEFAULT_RECOMMENDATION_RULES)
      .expect(403);
    await request(app.getHttpServer())
      .post(
        '/api/admin/site-settings/recommendations/preview?scenario=progress',
      )
      .set('Authorization', auth)
      .send(DEFAULT_RECOMMENDATION_RULES)
      .expect(403);
  });
  it('lets an administrator read configuration and simulate without personal history', async () => {
    const auth = `Bearer ${await token(userA, 'ADMIN')}`;
    await request(app.getHttpServer())
      .get('/api/admin/site-settings/recommendations')
      .set('Authorization', auth)
      .expect(200);
    expect(readRecommendations).toHaveBeenCalledOnce();
    const response = await request(app.getHttpServer())
      .post(
        '/api/admin/site-settings/recommendations/preview?scenario=progress&lang=vi',
      )
      .set('Authorization', auth)
      .send(DEFAULT_RECOMMENDATION_RULES)
      .expect(201);
    expect(response.body.items).toHaveLength(3);
  });
});
