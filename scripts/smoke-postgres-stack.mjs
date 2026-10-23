/** Run inside Identity: node scripts/smoke-postgres-stack.mjs. Never prints credentials or tokens. */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const pg = require('pg');
const { JwtService } = require('@nestjs/jwt');
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { io } = webRequire('socket.io-client');

const pool = new pg.Pool();
const base = process.env.SMOKE_GATEWAY_URL || 'http://gateway:5000';
async function check(path, token, expected = 200, options = {}) {
  const response = await fetch(base + path, {
    ...options, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers },
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  console.log(`${response.status} ${path}`);
  assert.equal(response.status, expected, `${path}: ${text.slice(0, 400)}`);
  return text;
}
try {
  const jwt = new JwtService();
  const admins = await pool.query('SELECT id FROM admins WHERE is_deleted = false LIMIT 1');
  assert(admins.rows[0], 'Seed an administrator before running this smoke');
  const adminToken = await jwt.signAsync({ _id: admins.rows[0].id, role: 'ADMIN' }, {
    secret: process.env.JWT_ACCESS_SECRET, expiresIn: '2m',
  });
  await check('/api/admin/users?page=1&limit=10', adminToken);
  await check('/api/admin/dashboard/overview?days=7', adminToken);
  await check('/api/admin/dictation', adminToken);
  await check('/api/admin/dictation/hierarchy', adminToken);
  await check('/api/admin/activity-logs', adminToken);
  await check('/api/_internal/read-models/users', null, 404);
  await check('/socket.io/?EIO=4&transport=polling', null);
  const privateUrl = 'http://identity-service:5000/api/_internal/read-models/users';
  const forbidden = await fetch(privateUrl);
  assert.equal(forbidden.status, 403, 'Internal read endpoint must require a service token');
  const privateResponse = await fetch(privateUrl, { headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN } });
  assert.equal(privateResponse.status, 200);
  const privateRows = (await privateResponse.json()).data;
  for (const row of privateRows) {
    for (const key of ['password_hash', 'code', 'code_expires_at']) assert(!(key in row));
    for (const key of ['password', 'passwordHash', 'code', 'codeExpiresAt', 'refreshToken']) assert(!(key in (row.payload || {})));
  }
  console.log('Internal reads require authentication and omit user secrets');

  const users = await pool.query('SELECT id FROM users WHERE is_deleted = false AND COALESCE(is_banned, false) = false LIMIT 1');
  assert(users.rows[0], 'Create a user before running authenticated home checks');
  const userId = users.rows[0].id;
  const userToken = await jwt.signAsync({ _id: userId, role: 'USER' }, {
    secret: process.env.JWT_ACCESS_SECRET, expiresIn: '2m',
  });
  await check(`/api/admin/users/${userId}`, adminToken);
  for (const path of [
    '/api/learning-activity/home?timezone=Asia%2FSaigon', '/api/learning-activity/recent?limit=8',
    '/api/learning/today-tasks', '/api/attempts/stats', '/api/attempts?status=IN_PROGRESS&limit=1',
    '/api/dictation/progress', '/api/arena/profile',
    '/api/learning/overview', '/api/learning/vocabulary', '/api/learning/dashboard-stats',
  ]) await check(path, userToken);
  await check('/api/learning/today-tasks', null, 401);
  await new Promise((resolve, reject) => {
    const socket = io(`${base}/arena`, { transports: ['websocket'], auth: { token: userToken }, reconnection: false, autoConnect: false });
    const timeout = setTimeout(() => finish(new Error('Arena authentication timed out')), 12000);
    function finish(error) { clearTimeout(timeout); socket.removeAllListeners(); socket.disconnect(); error ? reject(error) : resolve(); }
    socket.once('arena:authenticated', () => finish());
    socket.once('connect_error', error => finish(error));
    socket.once('disconnect', reason => finish(new Error(`Arena disconnected before authentication: ${reason}`)));
    socket.connect();
  });
  console.log('Arena WebSocket upgrade and user authentication passed');
  console.log('PostgreSQL microservice HTTP smoke passed');
} finally {
  await pool.end();
}
