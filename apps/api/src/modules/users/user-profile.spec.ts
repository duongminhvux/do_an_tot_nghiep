import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { databaseSuite } from '../../../test/native-database.js';
import { DomainOutboxService } from '../../common/events/domain-outbox.service.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { JwtStrategy } from '../auth/strategy/jwt.strategy.js';
import { sql } from '../../postgres/sql.js';
const suite = databaseSuite('identity');
const i18n = { t: async (key: string) => key };
const service = () =>
  new UsersService(suite.db, i18n as never, new DomainOutboxService(suite.db));
describe('learner account profile', () => {
  it('persists basic fields, updates the profile projection on subsequent authentication and preserves credentials', async () => {
    const users = service();
    const created = await users.createAdmin({
      email: 'profile@example.test',
      name: 'Original',
      password: 'AccountPassword123',
    });
    const before = await users.findById(created._id);
    const result = await users.updateProfile(created._id, {
      username: 'New display',
      fullName: 'Nguyễn Minh Anh',
      phone: '+84 912 345 678',
      bio: 'Learning English daily.',
    });
    expect(result.profile).toMatchObject({
      username: 'New display',
      fullName: 'Nguyễn Minh Anh',
      phone: '+84 912 345 678',
      bio: 'Learning English daily.',
      email: 'profile@example.test',
    });
    const after = await users.findById(created._id);
    expect(after?.password).toBe(before?.password);
    const strategy = new JwtStrategy(
      { get: () => 'profile-test-secret' } as never,
      users,
      {} as never,
    );
    const restored = await strategy.validate({
      role: 'USER',
      email: 'profile@example.test',
    });
    expect(restored).toMatchObject(result.profile);
    expect(restored).not.toHaveProperty('password');
    expect(restored).not.toHaveProperty('code');
    const events = await suite
      .records('outbox_events')
      .select(sql`event_type='identity.user.updated.v1'`);
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain('+84');
    expect(JSON.stringify(events)).not.toContain('Learning English');
  });
  it('only updates allowed fields and permits clearing optional details', async () => {
    const users = service();
    const user = await users.createAdmin({
      email: 'owner@example.test',
      name: 'Owner',
      password: 'AccountPassword123',
    });
    await users.updateProfile(user._id, {
      fullName: '',
      phone: '',
      bio: '',
      email: 'attacker@example.test',
      isBanned: true,
      password: 'plaintext',
      role: 'ADMIN',
    } as UpdateProfileDto);
    const stored = await users.findById(user._id);
    expect(stored?.email).toBe('owner@example.test');
    expect(stored?.isBanned).not.toBe(true);
    expect(stored?.password).not.toBe('plaintext');
    expect(stored).toMatchObject({ fullName: '', phone: '', bio: '' });
  });
  it('validates trimmed names, phone formats, field limits and rejects null/privileged values', () => {
    const valid = plainToInstance(UpdateProfileDto, {
      username: '  Minh Anh  ',
      fullName: ' Nguyễn Minh Anh ',
      phone: '+84 (912) 345-678',
      bio: ' Hello ',
    });
    expect(
      validateSync(valid, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
    expect(valid.username).toBe('Minh Anh');
    for (const body of [
      { username: ' ' },
      { username: null },
      { fullName: null },
      { phone: '-------' },
      { phone: 'abc1234' },
      { bio: 'x'.repeat(501) },
      { fullName: 'x'.repeat(101) },
      { email: 'other@example.test' },
      { role: 'ADMIN' },
    ]) {
      expect(
        validateSync(plainToInstance(UpdateProfileDto, body), {
          whitelist: true,
          forbidNonWhitelisted: true,
        }).length,
      ).toBeGreaterThan(0);
    }
  });
});
