import test from 'node:test';
import assert from 'node:assert/strict';
import { isEnabled, parseSeedOptions, seedAdminRecord } from './seed-admin-core.mjs';

function fakeCollection(initial = []) {
  const docs = initial.map((d) => ({ ...d }));
  let nextId = docs.length + 1;
  return {
    docs,
    async findOne(query) {
      const [key, val] = Object.entries(query)[0];
      return docs.find((doc) => doc[key] === val) || null;
    },
    async insertOne(doc) {
      if (docs.some((d) => d.email === doc.email)) throw new Error('duplicate email');
      docs.push({ _id: nextId++, ...doc });
    },
    async updateOne(query, change) {
      const d = docs.find((doc) => doc._id === query._id);
      assert.ok(d);
      Object.assign(d, change.$set);
      for (const key of Object.keys(change.$unset || {})) delete d[key];
    },
  };
}

const hash = async (password) => `hashed:${password}`;
const localDev = { DEFAULT_ADMIN_EMAIL: 'ADMIN@gmail.com', DEFAULT_ADMIN_USERNAME: 'admin', DEFAULT_ADMIN_PASSWORD: 'admin', ADMIN_SEED_ALLOW_WEAK_PASSWORD: 'true' };

test('boolean settings and default identity', () => {
  assert.equal(isEnabled('true'), true);
  assert.equal(isEnabled('FALSE'), false);
  const opts = parseSeedOptions([], localDev);
  assert.equal(opts.email, 'admin@gmail.com');
  assert.equal(opts.username, 'admin');
});

test('empty DB creates admin with hashed password and timestamps', async () => {
  const c = fakeCollection();
  const result = await seedAdminRecord(c, parseSeedOptions([], localDev), hash);
  assert.equal(result.status, 'created');
  assert.equal(c.docs.length, 1);
  assert.equal(c.docs[0].password, 'hashed:admin');
  assert.equal(c.docs[0].isDeleted, false);
  assert.ok(c.docs[0].createdAt instanceof Date);
});

test('re-run is idempotent, does not reset existing password', async () => {
  const c = fakeCollection([{ _id: 1, email: 'admin@gmail.com', username: 'admin', password: 'user-changed' }]);
  const result = await seedAdminRecord(c, parseSeedOptions([], localDev), hash);
  assert.equal(result.status, 'existing');
  assert.equal(c.docs.length, 1);
  assert.equal(c.docs[0].password, 'user-changed');
});

test('password reset only when explicitly requested', async () => {
  const c = fakeCollection([{ _id: 1, email: 'admin@gmail.com', username: 'admin', password: 'old' }]);
  const result = await seedAdminRecord(c, parseSeedOptions(['--reset-password'], localDev), hash);
  assert.equal(result.status, 'updated');
  assert.equal(c.docs[0].password, 'hashed:admin');
});

test('weak password rejected without dev-only opt-in', async () => {
  const c = fakeCollection();
  const opts = parseSeedOptions([], { ...localDev, ADMIN_SEED_ALLOW_WEAK_PASSWORD: 'false' });
  await assert.rejects(seedAdminRecord(c, opts, hash), /at least 12/);
  assert.equal(c.docs.length, 0);
});

test('existing accounts with conflicting email and username are untouched', async () => {
  const c = fakeCollection([
    { _id: 1, email: 'admin@gmail.com', username: 'oldAdmin', password: 'secret1' },
    { _id: 2, email: 'other@gmail.com', username: 'admin', password: 'secret2' },
  ]);
  await assert.rejects(seedAdminRecord(c, parseSeedOptions([], localDev), hash), /different admin accounts/);
  assert.equal(c.docs[0].password, 'secret1');
  assert.equal(c.docs[1].password, 'secret2');
});

test('disabled admin stays disabled until explicit --reactivate', async () => {
  const c = fakeCollection([{ _id: 1, email: 'admin@gmail.com', username: 'admin', password: 'old', isDeleted: true, deletedAt: new Date() }]);
  const unchanged = await seedAdminRecord(c, parseSeedOptions([], localDev), hash);
  assert.equal(unchanged.status, 'existing-disabled');
  assert.equal(c.docs[0].isDeleted, true);
  await seedAdminRecord(c, parseSeedOptions(['--reactivate'], localDev), hash);
  assert.equal(c.docs[0].isDeleted, false);
  assert.equal(c.docs[0].deletedAt, undefined);
  assert.equal(c.docs[0].password, 'old');
});

test('missing password fails on creation but allows an existing admin to remain untouched', async () => {
  const opts = parseSeedOptions([], { DEFAULT_ADMIN_EMAIL: 'admin@gmail.com', DEFAULT_ADMIN_USERNAME: 'admin' });
  await assert.rejects(seedAdminRecord(fakeCollection(), opts, hash), /DEFAULT_ADMIN_PASSWORD/);
  const existing = fakeCollection([{ _id: 1, email: opts.email, username: opts.username, password: 'safe' }]);
  const outcome = await seedAdminRecord(existing, opts, hash);
  assert.equal(outcome.status, 'existing');
});
