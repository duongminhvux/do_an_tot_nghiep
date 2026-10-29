/** Run inside Identity. Redirect stdout to an ignored local session file; contains tokens.
 * Uses the existing admin only for its authenticated session, creates isolated QA users
 * through the admin API, and sends no emails. Never commit the output.
 */
const { createRequire } = require('node:module');
const requireApi = createRequire('/app/apps/api/package.json');
const { Pool } = requireApi('pg');
const { JwtService } = requireApi('@nestjs/jwt');
const { randomBytes } = require('node:crypto');
(async () => {
  const pool = new Pool();
  try {
    const row = (await pool.query('SELECT id FROM admins WHERE is_deleted=false ORDER BY created_at LIMIT 1')).rows[0];
    if (!row) throw new Error('No administrator available');
    const jwt = new JwtService();
    const token = await jwt.signAsync({ _id: row.id, role: 'ADMIN' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '1h' });
    async function request(route, options = {}) {
      const response = await fetch('http://127.0.0.1:5000/api'+route, { ...options, headers: { authorization: 'Bearer '+token, 'content-type': 'application/json' } });
      if (!response.ok) throw new Error('Bootstrap API failed: '+route+' '+response.status);
      return (await response.json()).data;
    }
    const admin = { token, profile: await request('/admin/auth/me') };
    const run = Date.now().toString(36);
    const users = [];
    for (let n=1; n<=3; n++) {
      const password = randomBytes(18).toString('hex');
      const email = `ui-qa-${run}-${n}@example.invalid`;
      const profile = await request('/admin/users', { method:'POST', body:JSON.stringify({ name:`UI-QA-${run}-${n}`, email, password }) });
      users.push({ email, password, profile: { ...profile, role:'USER' } });
    }
    process.stdout.write(JSON.stringify({ run, admin, users }));
  } finally { await pool.end(); }
})().catch(error => { console.error(error.message); process.exitCode=1; });
