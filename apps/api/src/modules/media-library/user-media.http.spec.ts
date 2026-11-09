import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UserMediaController } from './media-library.module.js';
import { MediaLibraryService } from './media-library.service.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

describe('Avatar library HTTP authorization and query boundary', () => {
  let app: INestApplication;
  // Authentication is substituted here; production PermissionsGuard and RolesGuard run unchanged.
  let principal: Record<string, unknown> | undefined;
  const id = '10000000-0000-4000-8000-000000000001';
  const list = vi.fn(async () => ({ items: [], total: 0 }));
  const detail = vi.fn(async () => ({ item: { id }, assets: [] }));
  const admin = (permissions: string[]) => ({ role: 'ADMIN', status: 'ACTIVE', authVersion: 1, permissions });
  beforeAll(async () => {
    const reflector = new Reflector();
    const module = await Test.createTestingModule({
      controllers: [UserMediaController],
      providers: [
        { provide: MediaLibraryService, useValue: { list, detail } },
        { provide: RolesGuard, useValue: new RolesGuard(reflector) },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: any, _res: unknown, next: () => void) => { req.user = principal; next(); });
    app.useGlobalGuards(new PermissionsGuard(reflector));
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  beforeEach(() => { list.mockClear(); detail.mockClear(); principal = undefined; });
  afterAll(async () => { await app.close(); });

  it('requires an active administrator with both media and user read permissions', async () => {
    for (const actor of [undefined, { role: 'USER' }, admin(['media_library.read']), admin(['users.read'])]) {
      principal = actor;
      for (const path of ['', `/${id}`])
        await request(app.getHttpServer()).get(`/api/admin/media-library/users/items${path}`).expect(403);
    }
    expect(list).not.toHaveBeenCalled();
    expect(detail).not.toHaveBeenCalled();
  });

  it('routes bounded list/detail reads and marks responses private', async () => {
    principal = admin(['media_library.read', 'users.read']);
    const response = await request(app.getHttpServer()).get('/api/admin/media-library/users/items?kind=user&search=learner&page=2&pageSize=5').expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(list).toHaveBeenCalledWith('users', expect.objectContaining({ kind: 'user', search: 'learner', page: 2, pageSize: 5 }));
    await request(app.getHttpServer()).get(`/api/admin/media-library/users/items/${id}?kind=user`).expect(200);
    expect(detail).toHaveBeenCalledWith('users', id, 'user');
  });

  it('rejects malformed IDs and unbounded or unsupported query values', async () => {
    principal = admin(['media_library.read', 'users.read']);
    for (const query of ['page=0', 'page=1.5', 'pageSize=1000', 'kind=unknown', 'extra=1'])
      await request(app.getHttpServer()).get(`/api/admin/media-library/users/items?${query}`).expect(400);
    await request(app.getHttpServer()).get('/api/admin/media-library/users/items/not-a-uuid').expect(400);
    expect(list).not.toHaveBeenCalled();
    expect(detail).not.toHaveBeenCalled();
  });
});
