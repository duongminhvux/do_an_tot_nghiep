import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { ExamCommunityController } from './exam-community.controller.js';
import { ExamCommunityService } from './exam-community.service.js';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard.js';
import { ServiceJwtStrategy } from '../../../auth/service-jwt.module.js';
import { PublicProfilesController } from '../../../users/public-profiles.controller.js';
import { getConnectionToken } from '../../../../postgres/connection.js';
describe('TOEIC community HTTP', () => {
  let app: INestApplication;
  const jwt = new JwtService(),
    secret = 'community-http-test',
    actor = '10000000-0000-4000-8000-000000000001',
    id = '10000000-0000-4000-8000-000000000002';
  const list = vi.fn(async () => ({ items: [] })),
    post = vi.fn(async () => ({ id })),
    react = vi.fn(async () => ({ emoji: '👍' })),
    remove = vi.fn(async () => ({ deleted: true }));
  const profileQuery = vi.fn(async () => ({
    rows: [
      {
        id,
        username: 'Visible name',
        email: 'PRIVATE',
        password_hash: 'SECRET',
      },
    ],
  }));
  const auth = async (role = 'USER') =>
    `Bearer ${await jwt.signAsync({ _id: actor, role }, { secret, expiresIn: '5m' })}`;
  beforeAll(async () => {
    const reflector = new Reflector();
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [ExamCommunityController, PublicProfilesController],
      providers: [
        { provide: getConnectionToken(), useValue: { query: profileQuery } },
        {
          provide: ServiceJwtStrategy,
          useValue: new ServiceJwtStrategy(
            new ConfigService({ JWT_ACCESS_SECRET: secret }),
            {
              verifyToken: (raw: string) => jwt.verifyAsync(raw, { secret }),
            } as never,
          ),
        },
        {
          provide: ExamCommunityService,
          useValue: { leaderboard: list, comments: list, post, react, remove },
        },
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
  it('requires JWT for listing, posting, deleting and reactions', async () => {
    const base = `/api/exams/${id}`;
    await request(app.getHttpServer()).get(`${base}/leaderboard`).expect(401);
    await request(app.getHttpServer()).get(`${base}/comments`).expect(401);
    await request(app.getHttpServer())
      .post(`${base}/comments`)
      .send({ body: 'hello' })
      .expect(401);
    await request(app.getHttpServer())
      .put(`${base}/comments/${id}/reaction`)
      .send({ emoji: '👍' })
      .expect(401);
    await request(app.getHttpServer())
      .delete(`${base}/comments/${id}`)
      .expect(401);
  });
  it('takes author from JWT, accepts emoji replies and rejects spoofed fields', async () => {
    const token = await auth(),
      base = `/api/exams/${id}`;
    await request(app.getHttpServer())
      .post(`${base}/comments`)
      .set('Authorization', token)
      .send({ body: '  Xin chào 😊  ', replyToId: id })
      .expect(201);
    expect(post).toHaveBeenLastCalledWith(
      id,
      actor,
      expect.objectContaining({ body: 'Xin chào 😊', replyToId: id }),
    );
    for (const body of [
      { body: 'x', authorId: id },
      { body: 'x', username: 'fake' },
      { body: '   ' },
      { body: 'x'.repeat(2001) },
      { body: 'x', replyToId: 'wrong' },
    ])
      await request(app.getHttpServer())
        .post(`${base}/comments`)
        .set('Authorization', token)
        .send(body)
        .expect(400);
    await request(app.getHttpServer())
      .get(`${base}/leaderboard?page=2`)
      .set('Authorization', token)
      .expect(200)
      .expect('Cache-Control', 'private, no-store');
    expect(list).toHaveBeenLastCalledWith(id, actor, 2);
    for (const query of ['page=0', 'page=1.5', 'page=10001'])
      await request(app.getHttpServer())
        .get(`${base}/comments?${query}`)
        .set('Authorization', token)
        .expect(400);
  });
  it('validates reaction and comment IDs and forwards moderation role', async () => {
    const base = `/api/exams/${id}`,
      token = await auth();
    await request(app.getHttpServer())
      .put(`${base}/comments/${id}/reaction`)
      .set('Authorization', token)
      .send({ emoji: '❤️' })
      .expect(200);
    expect(react).toHaveBeenLastCalledWith(id, id, actor, '❤️');
    await request(app.getHttpServer())
      .put(`${base}/comments/${id}/reaction`)
      .set('Authorization', token)
      .send({ emoji: 'bad' })
      .expect(400);
    await request(app.getHttpServer())
      .delete(`${base}/comments/${id}/reaction`)
      .set('Authorization', token)
      .expect(200);
    expect(react).toHaveBeenLastCalledWith(id, id, actor, null);
    await request(app.getHttpServer())
      .delete(`${base}/comments/invalid`)
      .set('Authorization', token)
      .expect(400);
    await request(app.getHttpServer())
      .delete(`${base}/comments/${id}`)
      .set('Authorization', await auth('ADMIN'))
      .expect(200);
    expect(remove).toHaveBeenLastCalledWith(id, id, actor, true);
  });
  it('preserves Vietnamese translations and matching community keys', () => {
    const read = (language: string) =>
      JSON.parse(
        readFileSync(
          new URL(
            `../../../../../../web/locales/${language}/toeic.json`,
            import.meta.url,
          ),
          'utf8',
        ),
      ).community;
    const viText = read('vi'),
      enText = read('en');
    expect(viText.rankingTitle).toBe('Bảng xếp hạng thi thật');
    expect(Object.keys(viText)).toEqual(Object.keys(enText));
    expect(Object.keys(viText.columns)).toEqual(Object.keys(enText.columns));
  });
  it('bounds the internal profile lookup, requires its token and returns only display names', async () => {
    vi.stubEnv('SERVICE_ROLE', 'identity');
    vi.stubEnv('INTERNAL_SERVICE_TOKEN', 'community-profile-token-'.repeat(2));
    const path = '/api/_internal/exam-community/profiles';
    await request(app.getHttpServer())
      .post(path)
      .send({ ids: [id] })
      .expect(403);
    expect(profileQuery).not.toHaveBeenCalled();
    const response = await request(app.getHttpServer())
      .post(path)
      .set('x-internal-token', process.env.INTERNAL_SERVICE_TOKEN!)
      .send({ ids: [id, actor] })
      .expect(201);
    expect(response.body).toEqual({ [id]: 'Visible name', [actor]: null });
    expect(JSON.stringify(response.body)).not.toMatch(
      /PRIVATE|SECRET|email|password/,
    );
    for (const ids of [
      ['not-uuid'],
      [id, id],
      Array.from({ length: 101 }, () => id),
    ])
      await request(app.getHttpServer())
        .post(path)
        .set('x-internal-token', process.env.INTERNAL_SERVICE_TOKEN!)
        .send({ ids })
        .expect(400);
    vi.stubEnv('SERVICE_ROLE', 'assessment');
    await request(app.getHttpServer())
      .post(path)
      .set('x-internal-token', process.env.INTERNAL_SERVICE_TOKEN!)
      .send({ ids: [id] })
      .expect(403);
  });
});
