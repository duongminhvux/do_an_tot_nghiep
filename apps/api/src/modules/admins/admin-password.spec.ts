import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { hashPassword, comparePassword } from '../../common/bcrypt.js';
import { AdminsService } from './admins.service.js';
import type { PgConnection } from '../../postgres/connection.js';

const actor = { _id: '10000000-0000-4000-8000-000000000001', authVersion: 4 };
const oldPassword = 'CurrentPassword123',
  newPassword = 'ReplacementPassword456';
async function fixture() {
  const digest = await hashPassword(oldPassword);
  const query = vi.fn().mockResolvedValue({ rows: [{ id: actor._id }] });
  const db = { pool: { release() {} }, query } as unknown as PgConnection;
  const service = new AdminsService(db, {} as never, {} as never);
  const read = vi
    .spyOn(service, 'findById')
    .mockResolvedValue({
      _id: actor._id,
      status: 'ACTIVE',
      isDeleted: false,
      password: digest,
      authVersion: 4,
    } as never);
  return { service, query, read };
}
describe('administrator own password change', () => {
  it('verifies the old password, updates its hash atomically, revokes sessions and audits without secrets', async () => {
    const { service, query } = await fixture();
    await expect(
      service.changeOwnPassword(actor, oldPassword, newPassword),
    ).resolves.toEqual({ changed: true });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('auth_version=auth_version+1');
    expect(sql).toContain('password_hash=$4');
    expect(params.slice(0, 2)).toEqual([actor._id, 4]);
    expect(await comparePassword(newPassword, params[2])).toBe(true);
    const audit = JSON.stringify(query.mock.calls[1]);
    expect(audit).toContain('ADMIN_PASSWORD_CHANGED');
    expect(audit).not.toContain(oldPassword);
    expect(audit).not.toContain(newPassword);
    expect(audit).not.toContain(params[2]);
  });
  it('rejects a wrong current password or unchanged password without writing', async () => {
    const { service, query } = await fixture();
    await expect(
      service.changeOwnPassword(actor, 'wrong', newPassword),
    ).rejects.toMatchObject({ message: 'ADMIN_PASSWORD_INCORRECT' });
    await expect(
      service.changeOwnPassword(actor, oldPassword, oldPassword),
    ).rejects.toMatchObject({ message: 'ADMIN_PASSWORD_UNCHANGED' });
    expect(query).not.toHaveBeenCalled();
  });
  it('enforces the admin policy, including the bcrypt UTF-8 byte limit', async () => {
    const { service, query } = await fixture();
    for (const password of [
      'short',
      'longwithoutuppercase123',
      'NoNumbersInThisPassword',
      ' ReplacementPassword456',
      'Aa1' + 'é'.repeat(35),
    ]) {
      await expect(
        service.changeOwnPassword(actor, oldPassword, password),
      ).rejects.toMatchObject({ message: 'ADMIN_PASSWORD_POLICY' });
    }
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects stale or disabled identities and concurrent changes without auditing', async () => {
    const { service, query, read } = await fixture();
    await expect(
      service.changeOwnPassword(
        { ...actor, authVersion: 3 },
        oldPassword,
        newPassword,
      ),
    ).rejects.toMatchObject({ status: 401 });
    read.mockResolvedValueOnce({ status: 'DISABLED' } as never);
    await expect(
      service.changeOwnPassword(actor, oldPassword, newPassword),
    ).rejects.toMatchObject({ status: 401 });
    query.mockResolvedValueOnce({ rows: [] });
    await expect(
      service.changeOwnPassword(actor, oldPassword, newPassword),
    ).rejects.toMatchObject({ status: 401 });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
