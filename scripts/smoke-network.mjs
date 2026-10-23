/**
 * Read-only network smoke from inside any vocalearn-clean-api:local container.
 * Usage: docker compose exec -T identity-service node scripts/smoke-network.mjs
 * It never writes PostgreSQL, creates users, or reads secrets into logs.
 */
const timeout = 7000;
const results = [];
async function check(label, url, expected, init = {}) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
    let body;
    try { body = await response.json(); } catch { body = null; }
    const pass = expected.includes(response.status);
    const suffix = pass ? '' : ` [expected ${expected.join('/')}]`;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${label}: HTTP ${response.status}${suffix}`);
    results.push({ label, pass, status: response.status, body });
    return response;
  } catch (err) {
    console.log(`FAIL ${label}: ${err?.cause?.code || err?.name || String(err)}`);
    results.push({ label, pass: false });
  }
}

for (const role of ['identity', 'content', 'assessment', 'arena', 'learning', 'media-jobs', 'ai-import', 'notification']) {
  await check(`${role} -> /api/health`, `http://${role}-service:5000/api/health`, [200]);
}
await check('Gateway local health', 'http://gateway:5000/gateway/health', [200]);
await check('Gateway -> Identity', 'http://gateway:5000/gateway/identity-health', [200]);
await check('Gateway -> Admin auth (missing credentials)', 'http://gateway:5000/api/admin/auth/login', [400, 401], { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
await check('Gateway -> Learner XP home (anonymous)', 'http://gateway:5000/api/learning-activity/home', [401, 403]);
const token = process.env.INTERNAL_SERVICE_TOKEN || '';
const identityToken = process.env.IDENTITY_INTERNAL_TOKEN || '';
if (identityToken.length >= 24) {
  await check('Service -> Identity introspection (invalid user token)',
    'http://identity-service:5000/api/_internal/identity/introspect', [401],
    { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': identityToken },
      body: JSON.stringify({ accessToken: 'invalid-user-token' }) });
} else {
  console.log('FAIL Internal identity token is not configured');
  results.push({ label: 'Identity internal token', pass: false });
}
if (token.length >= 24) {
  await check('Service -> Learning XP internal (invalid payload)',
    'http://learning-service:5000/api/_internal/learning/activity', [400],
    { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': token },
      body: JSON.stringify({}) });
  await check('Service -> Notification internal (invalid payload)',
    'http://notification-service:5000/api/_internal/notification/activity', [400],
    { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': token },
      body: JSON.stringify({}) });
} else {
  console.log('FAIL INTERNAL_SERVICE_TOKEN is not configured');
  results.push({ label: 'INTERNAL_SERVICE_TOKEN', pass: false });
}
const failed = results.filter(x => !x.pass);
console.log(`\nNetwork API smoke: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exitCode = 1;
