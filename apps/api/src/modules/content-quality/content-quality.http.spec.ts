import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  ContentQualityController,
  QualitySourceController,
} from './content-quality.module.js';
import { ContentQualityService } from './content-quality.service.js';
import { QualitySourceService } from './quality-source.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ServiceJwtStrategy } from '../auth/service-jwt.module.js';
describe('F11 Admin HTTP and private source boundary', () => {
  let app: INestApplication;
  const jwt = new JwtService(),
    secret = 'f11-test-secret',
    actor = '10000000-0000-4000-8000-000000000001';
  const list = vi.fn(async () => ({ items: [] })),
    enqueue = vi.fn(async () => ({ id: actor })),
    batch = vi.fn(async () => ({ items: [], done: true }));
  const auth = async (role: string) =>
    `Bearer ${await jwt.signAsync({ _id: actor, role }, { secret, expiresIn: '5m' })}`;
  beforeAll(async () => {
    const reflector = new Reflector();
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [ContentQualityController, QualitySourceController],
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
        { provide: ContentQualityService, useValue: { list, enqueue } },
        { provide: QualitySourceService, useValue: { batch } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalGuards(new JwtAuthGuard(reflector));
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
  it('requires authentication and refuses learners for viewing and scans', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/content-quality')
      .expect(401);
    for (const method of ['get', 'post'] as const)
      await request(app.getHttpServer())
        [method](
          `/api/admin/content-quality${method === 'post' ? '/scans' : ''}`,
        )
        .set('Authorization', await auth('USER'))
        .expect(403);
    expect(enqueue).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });
  it('validates filters/page and takes the scan actor from JWT', async () => {
    const token = await auth('ADMIN');
    await request(app.getHttpServer())
      .get('/api/admin/content-quality?category=MEDIA&page=2&lang=en')
      .set('Authorization', token)
      .expect(200)
      .expect('Cache-Control', 'private, no-store');
    expect(list).toHaveBeenLastCalledWith('MEDIA', 2, 'en');
    for (const query of [
      'category=other',
      'page=0',
      'page=1.5',
      'page=100001',
      'lang=xx',
    ])
      await request(app.getHttpServer())
        .get(`/api/admin/content-quality?${query}`)
        .set('Authorization', token)
        .expect(400);
    await request(app.getHttpServer())
      .post('/api/admin/content-quality/scans')
      .send({ actorId: 'forged' })
      .set('Authorization', token)
      .expect(201);
    expect(enqueue).toHaveBeenLastCalledWith(actor);
  });
  it('protects the owner batch endpoint with internal token and validates its bounded cursor', async () => {
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'f11-private-token-'.repeat(3));
    const path =
      '/api/_internal/content-quality/exams?before=2026-10-28T00:00:00.000Z';
    await request(app.getHttpServer()).get(path).expect(403);
    await request(app.getHttpServer())
      .get(`${path}&cursor=not-a-uuid`)
      .set('x-internal-token', process.env.INTERNAL_SERVICE_TOKEN!)
      .expect(400);
    await request(app.getHttpServer())
      .get(path)
      .set('x-internal-token', process.env.INTERNAL_SERVICE_TOKEN!)
      .expect(200);
    expect(batch).toHaveBeenLastCalledWith(
      'exams',
      null,
      '2026-10-28T00:00:00.000Z',
    );
    vi.stubEnv('SERVICE_ROLE', 'content');
    await request(app.getHttpServer())
      .get(path)
      .set('x-internal-token', process.env.INTERNAL_SERVICE_TOKEN!)
      .expect(403);
  });
});
