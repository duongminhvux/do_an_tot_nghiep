import { PgId } from '../../../postgres/compat.js';
import { describe, it, expect, vi } from 'vitest';
import { MiniGameResultService } from './minigame-result.service.js';

describe('minigame results', () => {
  it('records every saved game as a learning activity', async () => {
    const _id = new PgId();
    const createdAt = new Date();
    const results = {
      create: vi.fn(async (doc: object) => ({ ...doc, _id, createdAt })) };
    const record = vi.fn(async () => true);
    const service = new MiniGameResultService(
      results as never,
      { record } as never,
    );
    const userId = String(new PgId());
    await service.save(userId, {
      gameType: 'WORD_SHOOTER',
      score: 420 } as never);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        module: 'MINIGAME',
        type: 'MINIGAME_PLAY',
        sourceKey: `minigame:${_id}`,
        xp: 5,
        score: 420,
        occurredAt: createdAt,
        metadata: { gameType: 'WORD_SHOOTER' } }),
    );
  });
});
