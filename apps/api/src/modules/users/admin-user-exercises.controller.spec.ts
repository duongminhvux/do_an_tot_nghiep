import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AdminUserExercisesController } from './admin-user-exercises.controller.js';
import { UserExercisesQueryDto } from './dto/user-exercises.dto.js';
import { PERMISSIONS_KEY } from '../auth/decorators/require-permissions.decorator.js';
const remote = vi.hoisted(() => vi.fn());
vi.mock('../../postgres/owner-client.js', () => ({ ownerRequest: remote }));
describe('Admin learner exercise authorization and routing', () => {
  beforeEach(() => remote.mockReset());
  it('requires users.read plus the module permission on both list and detail', () => {
    for (const [module, permission] of Object.entries({
      toeic: 'toeic.attempts.read',
      vocabulary: 'vocabulary.read',
      dictation: 'dictation.read',
      arena: 'arena.read',
      minigame: 'games.results.read',
    }))
      for (const method of [module, module + 'Detail']) {
        expect(
          Reflect.getMetadata(
            PERMISSIONS_KEY,
            (AdminUserExercisesController.prototype as any)[method],
          ),
        ).toEqual(['users.read', permission]);
      }
  });
  it('reads through the correct owner contract with the selected learner ID', async () => {
    const userId = randomUUID(),
      recordId = randomUUID(),
      controller = new AdminUserExercisesController({
        findById: async () => ({ _id: userId, isDeleted: false }),
      } as never);
    remote.mockResolvedValue({ items: [], total: 0 });
    await controller.toeicDetail(userId, recordId, new UserExercisesQueryDto());
    expect(remote).toHaveBeenCalledWith(
      'assessment',
      'user-learning/assessment/exercises/detail',
      expect.objectContaining({
        userId,
        module: 'toeic',
        recordId,
        page: 1,
        limit: 20,
      }),
    );
    await controller.dictation(userId, new UserExercisesQueryDto());
    expect(remote).toHaveBeenLastCalledWith(
      'content',
      'user-learning/content/exercises',
      expect.objectContaining({ userId, module: 'dictation' }),
    );
    remote.mockResolvedValue({ notFound: true });
    await expect(
      controller.toeicDetail(userId, recordId, new UserExercisesQueryDto()),
    ).rejects.toThrow('Exercise not found for this learner');
  });
  it('does not fetch source data for invalid or deleted learner IDs', async () => {
    const controller = new AdminUserExercisesController({
      findById: async () => ({ isDeleted: true }),
    } as never);
    await expect(
      controller.arena('bad-id', new UserExercisesQueryDto()),
    ).rejects.toThrow('Invalid learner');
    await expect(
      controller.arena(randomUUID(), new UserExercisesQueryDto()),
    ).rejects.toThrow('Learner not found');
    expect(remote).not.toHaveBeenCalled();
  });
});
