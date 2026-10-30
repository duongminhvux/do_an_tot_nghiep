/** Browser checks against isolated Next frontends. APIs are intercepted, never live data.
 * npm.cmd install --prefix .tmp/ui-qa --no-package-lock playwright-core
 * node tests/ui-browser-smoke.cjs
 * WEB_QA_URL / ADMIN_QA_URL and CHROME_PATH can override local defaults.
 */
const { chromium } = require('../.tmp/ui-qa/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve(process.env.QA_OUTPUT || '.tmp/ui-qa/results');
fs.mkdirSync(output, { recursive: true });
const results = [];
const requests = new Set();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const token = `qa.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.fixture`;
const user = admin => ({ _id: id(1), username: 'qa', name: 'QA Browser', email: 'qa@example.invalid', role: admin ? 'ADMIN' : 'USER', isVerified: true, createdAt: '2026-10-01T00:00:00Z' });
const lessons = Array.from({ length: 23 }, (_, n) => ({ _id: id(100+n), title: `QA Lesson ${String(n+1).padStart(2,'0')}`, slug: `qa-lesson-${n+1}`, description: 'Browser fixture', topic: 'QA Topic', topicId: id(200), sectionId: id(300), level: 'A1', status: 'DRAFT', audioSource: 'TTS', language: 'en-US', voiceIds: [], sentenceCount: 23, totalDurationMs: 23000, order: n, sourceText: 'Hello world.', speed: 1, pauseAfterMs: 300, publicationStatus: 'DRAFT', createdAt: '2026-10-01T00:00:00Z' }));
const segments = Array.from({ length: 23 }, (_, n) => ({ _id: id(400+n), lessonId: id(100), order: n, text: `Sentence ${n+1}.`, source: 'TTS', language: 'en-US', speed: 1, startMs: n*1000, endMs: (n+1)*1000, durationMs: 1000 }));
const topics = Array.from({ length: 13 }, (_, n) => ({ _id: id(200+n), title: `QA Topic ${n+1}`, slug: `qa-topic-${n+1}`, description: 'Browser fixture', order: n, isActive: true, sectionCount: 7, lessonCount: 23, sentenceCount: 23, totalDurationMs: 23000, levels: ['A1'], completedLessons: 0, sections: Array.from({ length: 7 }, (_, j) => ({ _id: id(300+j), topicId: id(200+n), title: `QA Section ${j+1}`, slug: `qa-section-${j+1}`, order: j, isActive: true, lessons })) }));
const groups = Array.from({ length: 23 }, (_, n) => ({ _id: id(500+n), name: `QA Group ${String(n+1).padStart(2,'0')}`, slug: `qa-group-${n+1}`, isActive: true, order: n, collectionsCount: 0, lessonsCount: 0, wordsCount: 0 }));
const progress = { lessonId: id(100), currentSegment: 0, completedSegments: [], revealedSegments: [], segmentProgress: [], correctCount: 0, wrongCount: 0, attempts: 0, completed: false };

function fixture(url) {
  const p = url.pathname.replace(/^\/api/, '');
  if (p === '/admin/vocabulary-groups') return { data: groups, total: groups.length, page: 1, limit: 100 };
  if (p === '/admin/collections') return { data: [], total: 0, page: 1, limit: 100 };
  if (p === '/admin/words') return { data: [], total: 0, page: 1, limit: 10 };
  if (p === '/admin/lessons') return [];
  if (p === '/dictation/topics' || p === '/admin/dictation/hierarchy') return topics;
  if (p.startsWith('/dictation/topics/')) return topics[0];
  if (p === '/admin/dictation' || p === '/dictation') return lessons;
  if (p === '/dictation/progress') return { totalStarted: 0, completed: 0, totalCorrect: 0, totalAttempts: 0, items: [] };
  if (/\/dictation\/[^/]+\/progress$/.test(p)) return progress;
  if (p === '/admin/dictation/voices') return { voices: [] };
  if (p === '/admin/dictation/processors/health') return { tts: {}, asr: {} };
  if (p.startsWith('/dictation/slug/') || /^\/admin\/dictation\/[^/]+$/.test(p)) return { ...lessons[0], segments };
  return undefined;
}

async function context(browser, app, { authenticated = true, mode = 'error', mobile = false } = {}) {
  const admin = app === 'admin';
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  if (authenticated) await ctx.addInitScript(({ token, user, admin }) => {
    localStorage.setItem(admin ? 'adminAccessToken' : 'accessToken', token);
    localStorage.setItem(admin ? 'adminUser' : 'user', JSON.stringify(user));
    localStorage.setItem('i18nextLng', 'vi');
    document.cookie = `${admin ? 'adminAccessToken' : 'accessToken'}=${token}; path=/; SameSite=Lax`;
  }, { token, user: user(admin), admin });
  await ctx.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    requests.add(`${route.request().method()} ${url.pathname}`);
    const p = url.pathname.replace(/^\/api/, '');
    let status = 200, data;
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (p.endsWith('/auth/me')) { status = authenticated ? 200 : 401; data = user(admin); }
    else if (p.endsWith('/auth/refresh-token')) status = 401;
    else if (p.endsWith('/auth/login')) status = 401;
    else if (p === '/site-settings') data = {};
    else if (mode === 'success' && fixture(url) !== undefined) data = fixture(url);
    else status = 503;
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { statusCode: 200, message: 'OK', data } : { statusCode: status, message: status === 401 ? 'QA invalid credentials' : 'QA service unavailable' }) });
  });
  // Block real Arena connections, including if a developer's socket URL points to a live stack.
  await ctx.route('**/socket.io/**', route => route.abort());
  await ctx.routeWebSocket('**/socket.io/**', socket => socket.close());
  return ctx;
}
const base = app => app === 'admin' ? process.env.ADMIN_QA_URL || 'http://localhost:3101' : process.env.WEB_QA_URL || 'http://localhost:3100';
async function check(ctx, app, route, name, run, wait = 1000) {
  if (process.env.QA_ONLY && !name.match(new RegExp(process.env.QA_ONLY))) return;
  const page = await ctx.newPage();
  const errors = [], consoleErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error' && !/Failed to load resource|net::ERR|WebSocket|socket/i.test(msg.text())) consoleErrors.push(msg.text()); });
  const record = { app, route, name, viewport: page.viewportSize(), errors, consoleErrors };
  try {
    const response = await page.goto(base(app)+route, { waitUntil: 'domcontentloaded', timeout: 90000 });
    record.httpStatus = response.status();
    assert(response.status() < 400, `HTTP ${response.status()}`);
    await page.waitForTimeout(wait);
    if (run) await run(page);
    record.finalUrl = page.url();
    record.title = await page.title();
    record.horizontalOverflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    record.bodyExcerpt = (await page.locator('body').innerText()).slice(-600);
    record.loadingIndicators = await page.locator('.animate-spin:visible').count();
    assert(!/Application error: a client-side exception|Internal Server Error/.test(await page.locator('body').innerText()), 'Error overlay rendered');
    assert.deepEqual(errors, [], 'Uncaught browser errors');
    assert(!consoleErrors.some(e => /hydration|maximum update depth|cannot update|each child|validateDOMNesting|cannot be a descendant/i.test(e)), 'React console error');
    if (record.horizontalOverflow.document > record.horizontalOverflow.viewport + 2) record.layoutWarning = 'Page overflows horizontally';
    record.status = 'PASS';
  } catch (error) {
    record.status = 'FAIL'; record.failure = error.message;
    record.finalUrl = page.url();
    record.bodyExcerpt = (await page.locator('body').innerText().catch(() => '')).slice(-1000);
    record.loadingIndicators = await page.locator('.animate-spin:visible').count();
  }
  const file = `${app}-${name.replace(/[^a-z0-9-]/gi,'-')}.png`;
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.screenshot({ path: path.join(output,file), fullPage: true, timeout: 15000 }).catch(() => {});
  record.screenshot = file;
  results.push(record);
  fs.writeFileSync(path.join(output,'report.json'), JSON.stringify({ backend: 'Intercepted fixture APIs; no live backend/database', results, requests: [...requests].sort() }, null, 2));
  console.log(`${record.status} ${app} ${name}${record.layoutWarning ? ' [OVERFLOW]' : ''}${record.failure ? ': '+record.failure.slice(0,180) : ''}`);
  await page.close();
}

async function suite(browser, app) {
  const anon = await context(browser, app, { authenticated: false });
  await check(anon, app, '/vi/login', 'login-validation', async page => {
    await page.locator('form button[type=submit]').click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('form p.text-red-500').count(), 2, 'Both required fields show validation');
    await page.locator('#username').fill('qa@example.invalid');
    await page.locator('#password').fill('invalid-password');
    await page.getByRole('button', { name: 'Toggle password visibility' }).click();
    assert.equal(await page.locator('#password').getAttribute('type'), 'text');
    await page.getByRole('button', { name: 'Toggle password visibility' }).click();
    assert.equal(await page.locator('#password').getAttribute('type'), 'password');
    await page.locator('form button[type=submit]').click();
    await page.getByText('QA invalid credentials', { exact: true }).waitFor();
  });
  await check(anon, app, '/vi/dictation', 'unauthenticated-redirect', async page => {
    await page.waitForURL('**/vi/login', { timeout: 15000 });
  });
  if (app === 'web') for (const route of ['/register','/forgot-password','/reset-password','/verify-email']) {
    await check(anon, app, '/vi'+route, 'auth'+route.replaceAll('/','-'));
  }
  await anon.close();
  const populated = await context(browser, app, { mode: 'success' });
  if (app === 'web') {
    await check(populated, app, '/vi/dictation', 'dictation-menu', async page => {
      const button = page.locator('button[aria-controls="dictation-submenu"]');
      await button.waitFor();
      assert.equal(await button.getAttribute('aria-expanded'), 'true');
      await button.click();
      assert.equal(await button.getAttribute('aria-expanded'), 'false');
      await button.click();
      assert.equal(await button.getAttribute('aria-expanded'), 'true');
      await page.locator('a[href="/vi/dictation/progress"]').click();
      await page.waitForURL('**/vi/dictation/progress');
      await page.getByRole('heading', { name: /tiến độ/i }).waitFor();
    });
    await check(populated, app, '/vi/dictation/topic/qa-topic-1', 'topic-populated');
    await check(populated, app, '/vi/dictation/qa-lesson-1', 'practice-populated');
  } else {
    await check(populated, app, '/vi/dictation', 'dictation-pagination', async page => {
      await page.getByText('QA Lesson 01', { exact: true }).waitFor();
      assert.equal(await page.getByText('QA Lesson 11', { exact: true }).count(),0);
      await page.getByRole('button', { name: 'Next page', exact: true }).click();
      await page.getByText('QA Lesson 11', { exact: true }).waitFor();
      assert.equal(await page.getByText('QA Lesson 01', { exact: true }).count(),0);
      await page.getByRole('combobox', { name: 'Số mục mỗi trang' }).selectOption('20');
      await page.getByText('QA Lesson 01', { exact: true }).waitFor();
      await page.getByText('QA Lesson 20', { exact: true }).waitFor();
    });
    await check(populated, app, '/vi/vocabulary/groups', 'groups-pagination', async page => {
      await page.getByText('QA Group 01', { exact: true }).first().waitFor();
      await page.getByRole('button', { name: 'Next page', exact: true }).click();
      await page.getByText('QA Group 11', { exact: true }).waitFor();
    });
    await check(populated, app, '/vi/dictation/structure', 'nested-pagination', async page => {
      await page.getByRole('button', { name: 'Next page', exact: true }).first().waitFor();
    });
    await check(populated, app, '/vi/dictation/'+id(100), 'segment-edit-populated', async page => {
      const next = page.getByRole('button', { name: 'Next page', exact: true });
      await next.waitFor();
      await next.click();
      const text = page.locator('textarea').filter({ hasText: 'Sentence 11.' });
      await text.waitFor();
      await text.fill('QA changed sentence 11.');
      await page.getByRole('button', { name: 'Previous page', exact: true }).click();
      await page.locator('textarea').filter({ hasText: 'Sentence 1.' }).waitFor();
      await next.click();
      assert.equal(await page.locator('textarea').filter({ hasText: 'QA changed sentence 11.' }).inputValue(), 'QA changed sentence 11.');
    });
  }
  await populated.close();
  const routes = app === 'web'
    ? ['', '/vocabulary', '/vocabulary/my-words', '/vocabulary/review', '/dictation', '/dictation/progress', '/toeic', '/toeic/history', '/toeic/stats', '/learning/mistakes', '/games', '/games/typing-rush', '/games/meaning-typing', '/games/word-shooter', '/arena']
    : ['', '/users', '/vocabulary/groups', '/vocabulary/collections', '/vocabulary/words', '/dictation', '/dictation/structure', '/dictation/create', '/assessment', '/assessment/groups', '/assessment/create', '/assessment/create/ai', '/assessment/ai-learning', '/games', '/games/scores', '/games/statistics', '/learning/mistakes', '/learning/recommendations', '/arena', '/arena/players', '/arena/matches', '/arena/rooms', '/arena/settings', '/content/quality', '/settings', '/infrastructure'];
  const failedApi = await context(browser, app);
  for (const route of routes) await check(failedApi, app, '/vi'+route, 'api-error-'+(route || 'home').replaceAll('/','-'), null, 8500);
  if (app === 'admin') await check(failedApi, app, '/vi/dictation/'+id(100), 'api-error-dictation-detail', null, 10000);
  if (app === 'web') for (const route of ['/dictation','/dictation/progress']) {
    await check(failedApi, app, '/vi'+route, 'regression-error-notice'+route.replaceAll('/','-'), async page => {
      assert(await page.getByText(/không thể tải|không tải được|chưa tải được|service unavailable/i).count() > 0,
        'Failed API must display an error notice instead of pretending data is empty');
    }, 10000);
  }
  else await check(failedApi, app, '/vi/dictation/'+id(100), 'regression-detail-stuck-loading', async page => {
    assert.equal(await page.locator('.animate-spin:visible').count(), 0,
      'A completed failed request must stop the loading spinner and show an error');
  }, 10000);
  await failedApi.close();
  if (app === 'admin') {
    const empty = await context(browser, app, { mode: 'success' });
    await check(empty, app, '/vi/vocabulary/words', 'regression-empty-range', async page => {
      await page.getByText(/Không tìm thấy từ vựng nào/).waitFor();
      assert(!/Hiển thị 0\s*-\s*10 trên 0/.test(await page.locator('body').innerText()),
        'Zero records must show 0–0, not 0–10');
    }, 1500);
    await empty.close();
  }
  const mobile = await context(browser, app, { mode: 'success', mobile: true });
  for (const route of ['/dictation', ...(app === 'admin' ? ['/vocabulary/groups','/dictation/structure'] : ['/dictation/progress','/dictation/topic/qa-topic-1'])]) {
    await check(mobile, app, '/vi'+route, 'mobile'+route.replaceAll('/','-'), null, 1500);
  }
  await check(mobile, app, '/en/dictation', 'english-mobile', null, 1500);
  if (app === 'web') await check(mobile, app, '/vi/dictation', 'mobile-menu-interaction', async page => {
    await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).first().click();
    const group = page.locator('button[aria-controls="dictation-submenu"]');
    await group.waitFor({ state: 'visible' });
    await group.click();
    assert.equal(await group.getAttribute('aria-expanded'),'false');
    await group.click();
    await page.locator('a[href="/vi/dictation/progress"]').click();
    await page.waitForURL('**/vi/dictation/progress');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  });
  await mobile.close();
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-networking'] });
  try { await Promise.all((process.env.QA_APPS ? process.env.QA_APPS.split(',') : ['web','admin']).map(app => suite(browser, app))); }
  finally { await browser.close(); }
  console.log(JSON.stringify({ checks: results.length, failed: results.filter(x=>x.status==='FAIL').length, overflow: results.filter(x=>x.layoutWarning).length, output }));
  process.exitCode = results.some(x=>x.status==='FAIL') ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode=1; });
