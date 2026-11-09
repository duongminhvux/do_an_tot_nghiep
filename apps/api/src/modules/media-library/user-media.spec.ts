import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { databaseSuite } from '../../../test/native-database.js';
import { sql } from '../../postgres/sql.js';
import { MediaLibraryService } from './media-library.service.js';

describe('User avatar library on the Identity owner', () => {
  const suite = databaseSuite('identity');
  const user = (patch: Record<string, unknown> = {}) => suite.records('users').insert({
    email: `${randomUUID()}@example.test`, username: 'Avatar owner',
    avatarUrl: '/media/uploads/avatars/current.png', ...patch,
  });
  const library = () => new MediaLibraryService(suite.db);

  it('includes uploaded and linked avatars, excludes deleted users and empty avatars, paginates in SQL', async () => {
    vi.stubEnv('MEDIA_PUBLIC_BASE_URL', 'https://media.example.test/media');
    const first = await user({ username: 'Alpha', email: 'alpha@example.test' });
    await user({ username: 'Beta', avatarUrl: 'https://profiles.example.test/photo.jpg', isBanned: true });
    await user({ username: 'Deleted', isDeleted: true });
    await user({ username: 'No avatar', avatarUrl: '   ' });
    await user({ username: 'Null avatar', avatarUrl: null });
    const page = await library().list('users', { page: 1, pageSize: 1 });
    expect(page.total).toBe(2);
    expect(page.items).toEqual([{
      id: first._id, title: 'Alpha', subtitle: 'alpha@example.test', status: 'ACTIVE',
      kind: 'user', previewUrl: 'https://media.example.test/media/uploads/avatars/current.png',
    }]);
    const next = await library().list('users', { page: 2, pageSize: 1 });
    expect(next.items[0]).toMatchObject({ title: 'Beta', status: 'BANNED', previewUrl: 'https://profiles.example.test/photo.jpg' });
  });

  it('searches names and email safely without exposing password, verification code or payload', async () => {
    await user({ username: 'Learner', email: 'find-me@example.test', password: 'secret-password', code: 'secret-code', notes: 'private-note' });
    const page = await library().list('users', { search: 'FIND-ME', page: 1, pageSize: 10 });
    expect(page.total).toBe(1);
    expect(Object.keys(page.items[0]).sort()).toEqual(['id', 'kind', 'previewUrl', 'status', 'subtitle', 'title']);
    expect(JSON.stringify(page)).not.toMatch(/secret-password|secret-code|private-note/);
    expect((await library().list('users', { search: "' OR TRUE --", page: 1, pageSize: 10 })).total).toBe(0);
  });

  it('returns only the selected current avatar and reflects replacement immediately', async () => {
    const owner = await user();
    await user({ avatarUrl: 'https://profiles.example.test/another-user.jpg' });
    const service = library();
    const result = await service.detail('users', owner._id, 'user');
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({ type: 'image', usages: [{ sourceId: owner._id }] });
    expect(result.assets[0].url).toContain('/uploads/avatars/current.png');
    await suite.records('users').patch(sql`id=${owner._id}::uuid`, { avatarUrl: '/media/uploads/avatars/replaced.png' });
    expect((await service.detail('users', owner._id)).assets[0].url).toContain('/avatars/replaced.png');
    await suite.records('users').patch(sql`id=${owner._id}::uuid`, { avatarUrl: '' });
    await expect(service.detail('users', owner._id)).rejects.toThrow('Media resource not found');
  });

  it('does not use legacy payload avatars or expose unsafe URLs for preview', async () => {
    const legacy = await user({ avatarUrl: null });
    await suite.db.query('UPDATE users SET payload=$2::jsonb WHERE id=$1', [legacy._id, JSON.stringify({ avatarUrl: 'https://old.example.test/photo.png' })]);
    await expect(library().detail('users', legacy._id)).rejects.toThrow('Media resource not found');
    const unsafe = await user({ avatarUrl: 'javascript:alert(1)' });
    const result = await library().detail('users', unsafe._id);
    expect(result.assets).toEqual([]);
    expect(result.item.previewUrl).toBeUndefined();
  });

  it('refuses another owner and unsupported kinds without querying user data', async () => {
    vi.stubEnv('SERVICE_ROLE', 'content');
    await expect(library().list('users', { page: 1, pageSize: 10 })).rejects.toThrow('Forbidden');
    vi.stubEnv('SERVICE_ROLE', 'identity');
    await expect(library().list('users', { kind: 'exam', page: 1, pageSize: 10 })).rejects.toThrow('Unsupported media resource');
    expect(suite.statements).toHaveLength(0);
  });
});
