import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/guards/roles.guard.js';
import { ServiceJwtStrategy } from '../../auth/service-jwt.module.js';
import {
  MistakesController,
  AdminMistakesController,
} from './mistakes.controller.js';
import { MistakesService } from './mistakes.service.js';
describe('F02 HTTP authorization', () => {
  let app: INestApplication;
  const jwt = new JwtService(),
    secret = 'f02-test-secret',
    user = '10000000-0000-4000-8000-000000000001';
  const list = vi.fn(async () => ({ items: [], total: 0, pending: 0 })),
    statistics = vi.fn(async () => ({ minimumLearners: 20, items: [] }));
  beforeAll(async () => {
    const reflector = new Reflector();
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [MistakesController, AdminMistakesController],
      providers: [
        {
          provide: ServiceJwtStrategy,
          useValue: new ServiceJwtStrategy(
            new ConfigService({ JWT_ACCESS_SECRET: secret }),
            {
              verifyToken: (raw: string) => jwt.verifyAsync(raw, { secret }),
            } as never,
          ),
        },
        { provide: RolesGuard, useValue: new RolesGuard(reflector) },
        {
          provide: MistakesService,
          useValue: {
            list,
            statistics,
            detail: vi.fn(),
            markReviewed: vi.fn(),
          },
        },
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
  it('requires a JWT and derives notebook identity from it', async () => {
    await request(app.getHttpServer())
      .get('/api/learning/mistakes')
      .expect(401);
    const token = await jwt.signAsync({ _id: user, role: 'USER' }, { secret });
    const response = await request(app.getHttpServer())
      .get('/api/learning/mistakes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(list).toHaveBeenCalledWith(user, expect.anything());
  });
  it('blocks a learner from aggregate Admin APIs and exposes no Admin personal notebook lookup', async () => {
    const token = await jwt.signAsync({ _id: user, role: 'USER' }, { secret });
    await request(app.getHttpServer())
      .get('/api/admin/learning/mistakes/statistics')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    const admin = await jwt.signAsync({ _id: user, role: 'ADMIN' }, { secret });
    await request(app.getHttpServer())
      .get('/api/admin/learning/mistakes/statistics')
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/admin/learning/mistakes/${user}`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(404);
    expect(statistics).toHaveBeenCalledOnce();
  });
  it('rejects malformed notebook IDs before entering business logic', async () => {
    const token = await jwt.signAsync({ _id: user, role: 'USER' }, { secret });
    await request(app.getHttpServer())
      .get('/api/learning/mistakes/bad-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
