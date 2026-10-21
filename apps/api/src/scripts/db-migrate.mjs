import mongoose from 'mongoose';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { loadRootEnv } from './load-root-env.mjs';

loadRootEnv();
const root = resolve(import.meta.dirname, '../../../../');
const folder = join(root, 'database/migrations');
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/english-platform';
const dryRun = process.argv.includes('--dry-run');
const statusOnly = process.argv.includes('--status');
await mongoose.connect(uri, { autoIndex: false });
try {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB not connected');
  const manifest = JSON.parse(await readFile(join(root, 'database/schema-manifest.json'), 'utf8'));
  for (const model of manifest.models) {
    if (!/^apps\/api\/src\/modules\/[a-zA-Z0-9_./-]+\.schema\.ts$/.test(model.path)) {
      throw new Error('Invalid schema manifest path');
    }
    const actual = createHash('sha256').update(await readFile(join(root, model.path))).digest('hex');
    if (actual !== model.sha256) {
      throw new Error(`Schema source changed without updating database/schema-manifest.json: ${model.path}`);
    }
  }
  const migrations = db.collection('schema_migrations');
  const files = (await readdir(folder)).filter((f) => /^\d{4}_[a-z0-9_-]+\.mjs$/.test(f)).sort();
  if (files.length === 0) throw new Error('No migrations available');
  const applied = await migrations.find({}).toArray();
  const byId = new Map(applied.map((x) => [x._id, x]));
  const known = new Set(files.map((f) => f.slice(0, -4)));
  for (const record of applied) {
    if (!known.has(record._id)) throw new Error(`Unknown applied migration ${record._id}. Refusing incompatible downgrade.`);
  }
  const pending = [];
  for (const file of files) {
    const name = file.slice(0, -4);
    const source = await readFile(join(folder, file));
    const checksum = createHash('sha256').update(source).digest('hex');
    const existing = byId.get(name);
    if (existing) {
      if (existing.checksum !== checksum) throw new Error(`Migration ${name} was modified after being applied`);
      console.log(`OK   ${name}`);
    } else {
      console.log(`WAIT ${name}`);
      pending.push({ name, file, checksum });
    }
  }
  if (statusOnly || dryRun) {
    console.log(`${pending.length} pending migration(s), no changes made.`);
  } else {
    // Only one deployment runner should execute at a time. Use the db-migrate
    // Compose one-shot service / deployment lock; never run in every API replica.
    for (const m of pending) {
      console.log(`APPLY ${m.name}`);
      const migration = await import(pathToFileURL(join(folder, m.file)).href);
      if (typeof migration.up !== 'function') throw new Error(`${m.name} missing up(db)`);
      await migration.up(db);
      await migrations.insertOne({ _id: m.name, checksum: m.checksum, appliedAt: new Date() });
      console.log(`DONE ${m.name}`);
    }
  }
} finally {
  await mongoose.disconnect();
}
