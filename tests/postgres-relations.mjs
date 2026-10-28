import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { DATABASES, migrationsFor, migrationSetChecksum, schemaFingerprint } from '../apps/api/src/postgres/migrations.ts';
import { checkRelations } from '../scripts/lib/postgres-relations.mjs';

const root = resolve(import.meta.dirname, '..');
const { Pool } = createRequire(resolve(root, 'apps/api/package.json'))('pg');
const name = `vocalearn-relations-${randomUUID().slice(0, 8)}`, password = randomUUID();
const contractsPath = resolve(root, 'database/postgres/migrations/contracts.json');
const contracts = JSON.parse(readFileSync(contractsPath, 'utf8'));
const report = { database: 'PostgreSQL 17, disposable fixtures only', owners: {}, checks: [], plans: {} };
let admin, started = false;
const pools = [];
function docker(args) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Docker failed');
  return result.stdout.trim();
}
function pass(label) { report.checks.push(label); console.log(`PASS ${label}`); }
async function rejected(db, query, params, constraint) {
  await assert.rejects(db.query(query, params), error => error.code === '23503' && error.constraint === constraint);
}
function hasIndex(node, name) { return (node['Index Name'] === name || node.Plans?.some(plan => hasIndex(plan, name))) ?? false; }
function indexedRelation(node, relation) {
  return (node['Relation Name'] === relation && /Index|Bitmap Heap/.test(node['Node Type'])) ||
    (node.Plans?.some(plan => indexedRelation(plan, relation)) ?? false);
}

async function content(db, migration) {
  const collection = randomUUID(), lesson = randomUUID(), otherLesson = randomUUID(), section = randomUUID(), word = randomUUID(), link = randomUUID();
  await db.query("INSERT INTO collections(id,name,slug) VALUES($1,'Fixture','fixture')", [collection]);
  await db.query("INSERT INTO lessons(id,collection_id,title,slug) VALUES($1,$3,'A','a'),($2,$3,'B','b')", [lesson, otherLesson, collection]);
  await db.query("INSERT INTO sections(id,lesson_id,name,slug) VALUES($1,$2,'Section','section')", [section, lesson]);
  await db.query("INSERT INTO words(id,word,slug,level) VALUES($1,'fixture','fixture','A1')", [word]);
  // Deliberately orphan one row before adoption. The migration must preserve it on failure.
  await db.query('INSERT INTO lessonwords(id,lesson_id,word_id) VALUES($1,$2,$3)', [link, lesson, randomUUID()]);
  const before = await checkRelations(db, 'content');
  assert.equal(before.find(row => row.constraint === 'lessonwords_word_fk').orphanCount, '1');
  await db.query('BEGIN');
  try {
    await db.query('SAVEPOINT orphan_case');
    await assert.rejects(db.query(migration.sql), error => error.code === '23503');
    await db.query('ROLLBACK TO SAVEPOINT orphan_case');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM lessonwords WHERE id=$1', [link])).rows[0].n, 1);
    await db.query('UPDATE lessonwords SET word_id=$1 WHERE id=$2', [word, link]);
    await db.query(migration.sql);
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  pass('Content preflight detects orphan; failed migration preserves original data');
  await rejected(db, 'INSERT INTO lessonwords(lesson_id,word_id) VALUES($1,$2)', [lesson, randomUUID()], 'lessonwords_word_fk');
  await rejected(db, 'UPDATE lessonwords SET section_id=$1,lesson_id=$2 WHERE id=$3', [section, otherLesson, link], 'lessonwords_section_lesson_fk');
  await rejected(db, 'DELETE FROM words WHERE id=$1', [word], 'lessonwords_word_fk');
  await db.query('UPDATE lessonwords SET section_id=$1 WHERE id=$2', [section, link]);
  await db.query('BEGIN');
  await db.query('UPDATE lessonwords SET section_id=NULL WHERE id=$1', [link]);
  await db.query('DELETE FROM sections WHERE id=$1', [section]);
  await db.query('COMMIT');
  assert((await checkRelations(db, 'content')).every(row => row.orphanCount === '0'));
  pass('Content rejects missing parent, cross-lesson section, and parent deletion; detach succeeds');

  await db.query(`INSERT INTO lessons(id,collection_id,title,slug)
    SELECT ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,$1,'Lesson '||i,'fixture-'||i FROM generate_series(1,5000) i`, [collection]);
  await db.query(`INSERT INTO words(id,word,slug,level)
    SELECT ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'Word '||i,'word-'||i,'A1' FROM generate_series(1,5000) i`);
  await db.query(`INSERT INTO lessonwords(lesson_id,word_id,"order")
    SELECT ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,1 FROM generate_series(1,5000) i`);
  await db.query('ANALYZE lessons; ANALYZE words; ANALYZE lessonwords');
  const plan = (await db.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
    SELECT lw.*,w.word FROM lessonwords lw JOIN words w ON w.id=lw.word_id
    WHERE lw.lesson_id=$1 ORDER BY lw.created_at DESC,lw.id DESC LIMIT 50`, [lesson])).rows[0]['QUERY PLAN'][0];
  assert(indexedRelation(plan.Plan, 'lessonwords'), 'Lesson-word filtering must use its own index');
  assert.equal(plan.Plan['Actual Rows'], 1);
  report.plans.lessonWords = plan;
  pass('Content EXPLAIN ANALYZE/BUFFERS uses indexed lesson-word lookup with 5000 fixture rows');
}

async function learning(db, migration) {
  const user = randomUUID(), other = randomUUID(), folder = randomUUID(), word = randomUUID(), session = randomUUID();
  await db.query("INSERT INTO vocabularyfolders(id,user_id,name) VALUES($1,$2,'Fixture')", [folder, user]);
  await db.query("INSERT INTO learningsessions(id,user_id,type,started_at) VALUES($1,$2,'REVIEW',now())", [session, user]);
  await db.query(migration.sql);
  await rejected(db, 'INSERT INTO usersavedwords(user_id,word_id,folder_id) VALUES($1,$2,$3)', [other, word, folder], 'usersavedwords_folder_owner_fk');
  await rejected(db, "INSERT INTO learningsessionwords(session_id,word_id,mode,answered_at) VALUES($1,$2,'TYPING',now())", [randomUUID(), word], 'learningsessionwords_session_fk');
  await db.query('INSERT INTO usersavedwords(user_id,word_id,folder_id,saved_at) VALUES($1,$2,$3,now())', [user, word, folder]);
  await rejected(db, 'DELETE FROM vocabularyfolders WHERE id=$1', [folder], 'usersavedwords_folder_owner_fk');
  await db.query('BEGIN');
  await db.query('UPDATE usersavedwords SET folder_id=NULL WHERE folder_id=$1', [folder]);
  await db.query('DELETE FROM vocabularyfolders WHERE id=$1', [folder]);
  await db.query('COMMIT');
  assert((await checkRelations(db, 'learning')).every(row => row.orphanCount === '0'));
  pass('Learning rejects cross-user folders and orphan sessions; folder detach/delete preserves saved words');
}

async function promoted(db, role, migration) {
  const id = randomUUID();
  if (role === 'assessment') {
    await db.query(`INSERT INTO attempts(id,user_id,exam_id,started_at,status,payload) VALUES($1,$2,$3,now(),'COMPLETED',$4)`,
      [id, randomUUID(), randomUUID(), JSON.stringify({ examPublicationRevision: 7, examSnapshot: { name: 'Old snapshot' }, extension: 'keep' })]);
  } else if (role === 'arena') {
    await db.query("INSERT INTO arenamatches(id,type,payload) VALUES($1,'RANK',$2)", [id, JSON.stringify({ rankedState: { version: 3 }, audioSettings: { audioEnabled: true }, extension: 'keep' })]);
  } else {
    await db.query("INSERT INTO activitylogs(id,action,category,description,payload) VALUES($1,'PAGE_VIEW','\"GENERAL\"','',$2)",
      [id, JSON.stringify({ descriptionKey: 'activity-log.messages.PAGE_VIEW', descriptionArgs: { title: 'Home' }, extension: 'keep' })]);
  }
  await db.query(migration.sql);
  const table = { assessment: 'attempts', arena: 'arenamatches', notification: 'activitylogs' }[role];
  const row = (await db.query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0];
  assert.deepEqual(row.payload, { extension: 'keep' });
  if (role === 'assessment') {
    assert.equal(row.exam_publication_revision, 7); assert.equal(row.exam_snapshot.name, 'Old snapshot');
    const exam = randomUUID();
    await db.query('BEGIN');
    await db.query("SET LOCAL vocalearn.publication_transition='1'");
    await db.query("INSERT INTO exams(id,name,slug,type,publication_status,publication_revision) VALUES($1,'Fixture','fixture','TOEIC','PUBLISHED',7)", [exam]);
    await db.query('COMMIT');
    await assert.rejects(db.query("INSERT INTO attempts(user_id,exam_id,started_at,exam_publication_revision) VALUES($1,$2,now(),6)", [randomUUID(), exam]), /publication changed/);
    await db.query("INSERT INTO attempts(user_id,exam_id,started_at,exam_publication_revision) VALUES($1,$2,now(),7)", [randomUUID(), exam]);
    pass('Assessment native revision trigger rejects stale snapshots and accepts current revision');
    await db.query(`INSERT INTO attempts(user_id,exam_id,started_at,mode,status,exam_publication_revision)
      SELECT gen_random_uuid(),$1,now(),'TEST','COMPLETED',i FROM generate_series(1,5000) i`, [exam]);
    await db.query('ANALYZE attempts');
    const plan = (await db.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id FROM attempts
      WHERE exam_id=$1 AND exam_publication_revision=$2 AND mode='TEST' AND status IN ('FINISHED','COMPLETED')`, [exam, 2500])).rows[0]['QUERY PLAN'][0];
    assert(hasIndex(plan.Plan, 'attempts_exam_revision_completed_idx'));
    assert.equal(plan.Plan['Actual Rows'], 1);
    report.plans.attemptRevision = plan;
    pass('Assessment EXPLAIN ANALYZE/BUFFERS uses typed revision index with 5000 fixture rows');
  } else if (role === 'arena') {
    assert.equal(row.ranked_state.version, 3); assert.equal(row.audio_settings.audioEnabled, true);
  } else {
    assert.equal(row.description_key, 'activity-log.messages.PAGE_VIEW'); assert.equal(row.description_args.title, 'Home');
  }
  pass(`${role} backfills native columns and removes only promoted payload keys`);
}

try {
  docker(['run', '--rm', '-d', '--name', name, '-p', '127.0.0.1::5432', '-e', `POSTGRES_PASSWORD=${password}`, 'postgres:17-alpine']);
  started = true;
  const port = Number(docker(['port', name, '5432/tcp']).split(':').at(-1));
  const connection = { host: '127.0.0.1', port, user: 'postgres', password, connectionTimeoutMillis: 10000 };
  admin = new Pool({ ...connection, database: 'postgres' });
  for (let i = 0; ; i++) {
    try { await admin.query('SELECT 1'); break; } catch (error) { if (i > 40) throw error; await setTimeout(250); }
  }
  for (const [role, database] of Object.entries(DATABASES)) {
    await admin.query(`CREATE DATABASE "${database}"`);
    const pool = new Pool({ ...connection, database }); pools.push(pool);
    const db = await pool.connect();
    try {
      const migrations = await migrationsFor(role), pending = migrations.filter(m => m.version.startsWith('0018_'));
      for (const migration of migrations.filter(m => !m.version.startsWith('0018_'))) await db.query(migration.sql);
      if (contracts[role].version !== migrations.at(-1).version) {
        assert.equal(await schemaFingerprint(db), contracts[role].fingerprint, `Existing ${role} reference must match before changing it`);
        assert.equal(migrationSetChecksum(migrations.filter(m => !m.version.startsWith('0018_'))), contracts[role].migrationsChecksum);
      }
      for (const migration of pending) {
        if (role === 'content') await content(db, migration);
        else if (role === 'learning') await learning(db, migration);
        else await promoted(db, role, migration);
      }
      const fingerprint = await schemaFingerprint(db);
      if (contracts[role].version === migrations.at(-1).version) {
        assert.equal(fingerprint, contracts[role].fingerprint, `${role} migrated schema reference`);
        assert.equal(migrationSetChecksum(migrations), contracts[role].migrationsChecksum, `${role} migration checksum`);
      }
      if (pending.length) contracts[role] = { version: migrations.at(-1).version, migrationsChecksum: migrationSetChecksum(migrations), fingerprint };
      const stats = (await db.query(`SELECT
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
        (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND column_name='payload') AS payload_tables,
        (SELECT count(*)::int FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace) AS foreign_keys,
        (SELECT count(*)::int FROM pg_constraint WHERE contype='f' AND NOT convalidated AND connamespace='public'::regnamespace) AS unvalidated_foreign_keys`)).rows[0];
      assert.equal(stats.unvalidated_foreign_keys, 0);
      report.owners[role] = { ...stats, version: migrations.at(-1).version, fingerprint };
    } finally { db.release(); }
  }
  if (process.argv.includes('--write-contracts')) writeFileSync(contractsPath, JSON.stringify(contracts, null, 2) + '\n');
  writeFileSync(resolve(root, 'POSTGRES_RELATIONAL_AUDIT.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`PASS ${report.checks.length} checks; all 8 owner schema references verified`);
} finally {
  await Promise.allSettled(pools.map(pool => pool.end()));
  await admin?.end();
  if (started) docker(['stop', name]);
}
