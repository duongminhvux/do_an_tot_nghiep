import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  ExamPublicationController,
  WordPublicationController,
  LessonPublicationController,
  DictationPublicationController,
} from './publication.module.js';
import { PublicationService } from './publication.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ServiceJwtStrategy } from '../auth/service-jwt.module.js';
import { AdminDictationController } from '../dictation/admin-dictation.controller.js';

describe('F10 HTTP roles and actor attribution', () => {
  let app: INestApplication;
  const jwt = new JwtService(),
    secret = 'f10-jwt-test-secret',
    actor = '10000000-0000-4000-8000-000000000001',
    id = '10000000-0000-4000-8000-000000000002';
  const info = vi.fn(async () => ({ id, publicationStatus: 'DRAFT' })),
    validate = vi.fn(async () => ({ id, publicationStatus: 'IN_REVIEW' })),
    publish = vi.fn(async () => ({ id, publicationStatus: 'PUBLISHED' })),
    preview = vi.fn(async () => ({ kind: 'exams', questions: [] }));
  const token = (role: string) =>
    jwt.signAsync({ _id: actor, role }, { secret, expiresIn: '5m' });
  beforeAll(async () => {
    const reflector = new Reflector();
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [
        ExamPublicationController,
        WordPublicationController,
        LessonPublicationController,
        DictationPublicationController,
      ],
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
          provide: PublicationService,
          useValue: { info, validate, publish, preview, unpublish: vi.fn() },
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
  it('requires authentication and rejects learner access to all review/preview APIs', async () => {
    await request(app.getHttpServer())
      .get(`/api/admin/exams/${id}/publication`)
      .expect(401);
    const auth = `Bearer ${await token('USER')}`;
    for (const kind of ['exams', 'words', 'lessons', 'dictation']) {
      await request(app.getHttpServer())
        .get(`/api/admin/${kind}/${id}/publication`)
        .set('Authorization', auth)
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/admin/${kind}/${id}/preview`)
        .set('Authorization', auth)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/admin/${kind}/${id}/validate`)
        .set('Authorization', auth)
        .expect(403);
    }
    expect(preview).not.toHaveBeenCalled();
  });
  it('takes the publisher identity from the JWT, ignores forged actor fields and keeps preview private', async () => {
    const auth = `Bearer ${await token('ADMIN')}`;
    await request(app.getHttpServer())
      .post(`/api/admin/exams/${id}/validate?lang=en`)
      .set('Authorization', auth)
      .expect(201);
    expect(validate).toHaveBeenCalledWith('exams', id, actor, 'en');
    await request(app.getHttpServer())
      .post(`/api/admin/exams/${id}/publish?lang=en`)
      .set('Authorization', auth)
      .send({ actorId: id })
      .expect(201);
    expect(publish).toHaveBeenCalledWith('exams', id, actor, 'en');
    const response = await request(app.getHttpServer())
      .get(`/api/admin/exams/${id}/preview`)
      .set('Authorization', auth)
      .expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    await request(app.getHttpServer())
      .get('/api/admin/exams/bad-id/publication')
      .set('Authorization', auth)
      .expect(400);
  });
  it('extends the existing Dictation publish route and forwards the authenticated actor', () => {
    const publish = vi.fn(),
      unpublish = vi.fn();
    const controller = new AdminDictationController(
      { publish, unpublish } as never,
      {} as never,
      {} as never,
    );
    controller.publish(id, { user: { _id: actor } });
    controller.unpublish(id, { user: { _id: actor } });
    expect(publish).toHaveBeenCalledWith(id, actor);
    expect(unpublish).toHaveBeenCalledWith(id, actor);
  });
});
