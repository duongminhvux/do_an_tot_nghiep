/** Run in learning-service. All fixtures are rolled back, including on assertion failure. */
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('reflect-metadata');
const { Pool } = require('pg');
const { makePgModel } = await import('../apps/api/dist/postgres/compat.js');
assert.equal(process.env.SERVICE_ROLE, 'learning', 'Run this test in learning-service');
const pool = new Pool();
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const games = makePgModel('GameDefinition', client);
  const code = `SMOKE_${randomUUID()}`;
  const game = await games.create({ code, name: 'JSONB regression fixture', destination: '/smoke', category: 'SOLO', badge: 'FEATURED', settings: { lives: 3 } });
  const stored = (await client.query('SELECT category, badge, settings FROM gamedefinitions WHERE id = $1', [String(game._id)])).rows[0];
  assert.equal(stored.category, 'SOLO');
  assert.equal(stored.badge, 'FEATURED');
  assert.deepEqual(stored.settings, { lives: 3 });
  await games.updateOne({ code }, { $set: { category: 'MULTIPLAYER', badge: null } });
  assert.equal((await games.findOne({ code })).category, 'MULTIPLAYER');
  assert.equal((await games.findOne({ code })).badge, null);

  const activities = makePgModel('LearningActivity', client);
  const userId = randomUUID();
  await activities.create({ userId, module: 'VOCAB', type: 'VOCAB_SESSION', sourceKey: 'first', xp: 10, occurredAt: '2026-10-23T18:00:00Z', score: 500 });
  await activities.create({ userId, module: 'VOCAB', type: 'VOCAB_SESSION', sourceKey: 'second', xp: 20, occurredAt: '2026-10-24T01:00:00Z', score: 700 });
  const totals = await activities.aggregate([
    { $match: { userId } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt', timezone: 'Asia/Saigon' } }, xp: { $sum: '$xp' }, avg: { $avg: '$score' } } },
  ]);
  assert.equal(totals.length, 1);
  assert.equal(totals[0]._id, '2026-10-24');
  assert.equal(totals[0].xp, 30);
  assert.equal(totals[0].avg, 600);
  console.log('Real PostgreSQL: JSONB scalar/null/object and populated daily totals passed; fixtures rolled back');
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}
