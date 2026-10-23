#!/usr/bin/env node
/** Manual import of a legacy mongodump restored into the legacy_import staging DB.
 * Execute with --plan, --apply or --verify. NEVER run on normal API startup.
 * Preserves _id/refs/old passwords, copies denormalized read projections,
 * and writes optional import receipts without changing the initialized schema.
 */
import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { loadRootEnv } from './load-root-env.mjs';
loadRootEnv();
const root = resolve(import.meta.dirname, '../../../..');
const schema = JSON.parse(await readFile(resolve(root, 'database/import/ownership.json'), 'utf8'));
const ownershipBytes = await readFile(resolve(root, 'database/import/ownership.json'));
const importManifestChecksum = createHash('sha256').update(ownershipBytes).digest('hex');
const mode = process.argv.includes('--plan') ? 'plan' : process.argv.includes('--verify') ? 'verify' : process.argv.includes('--apply') ? 'apply' : '';
if (!mode) throw new Error('Usage: node apps/api/src/scripts/import-legacy.mjs --plan|--apply|--verify');
if (mode === 'apply' && process.env.LEGACY_IMPORT_CONFIRMED !== 'YES') {
  throw new Error('Import requires LEGACY_IMPORT_CONFIRMED=YES after reviewing --plan. Pause all business writes before importing data.');
}
const legacyUri = process.env.LEGACY_IMPORT_URI || 'mongodb://mongo:27017/legacy_import?replicaSet=rs0';
const hostUri = process.env.MONGO_ADMIN_URI || 'mongodb://mongo:27017/?replicaSet=rs0';
if (!legacyUri || !hostUri) throw new Error('Set LEGACY_IMPORT_URI and MONGO_ADMIN_URI');
if (Object.values(schema.databases).some(x=>legacyUri.includes('/'+x))) throw new Error('Source must be the separate legacy_import database');
const ownerOf = new Map();
for (const [role, names] of Object.entries(schema.collections)) {
  for (const name of names) {
    if (ownerOf.has(name)) throw new Error(`Duplicate owner: ${name}`);
    ownerOf.set(name, role);
  }
}
for (const [name, targets] of Object.entries(schema.projections)) {
  if (!ownerOf.has(name)) throw new Error(`Projection ${name} has no owner`);
  for (const role of Object.keys(targets)) {
    if (!(role in schema.databases) || role===ownerOf.get(name)) throw new Error(`Invalid projection ${name}->${role}`);
  }
}
const sourceConn = await mongoose.createConnection(legacyUri, {autoIndex:false}).asPromise();
const targetConn = await mongoose.createConnection(hostUri, {autoIndex:false}).asPromise();
const source = sourceConn.db;
const client = targetConn.getClient();
if (!source) throw new Error('Source unavailable');
const targets = Object.fromEntries(Object.entries(schema.databases).map(([role, name])=>[role, client.db(name)]));
const configuredLegacyDbName = source.databaseName;
if (Object.values(schema.databases).includes(configuredLegacyDbName)) throw new Error('Source points to a target DB');
function projection(doc, fields) {
  if (fields==='*') return doc;
  const picked={};
  for (const key of fields) if (Object.hasOwn(doc,key)) picked[key]=doc[key];
  return picked;
}
function indexOptions(index) {
  const allowed = ['name','unique','sparse','expireAfterSeconds','partialFilterExpression','collation','weights','default_language','language_override','hidden'];
  return Object.fromEntries(allowed.filter(k=>Object.hasOwn(index,k)).map(k=>[k,index[k]]));
}
async function copyOne(name, from, into, fields) {
  const sourceCollection = from.collection(name), destCollection=into.collection(name);
  const cursor=sourceCollection.find({}, {batchSize:200});
  let buffer=[], copied=0;
  async function flush() {
    if (!buffer.length) return;
    await destCollection.bulkWrite(buffer.map(doc=>({updateOne:{filter:{_id:doc._id}, update:{$setOnInsert:doc}, upsert:true}})),{ordered:false});
    copied+=buffer.length;buffer=[];
  }
  for await (const raw of cursor) {
    buffer.push(projection(raw,fields));
    if (buffer.length===200) await flush();
  }
  await flush();
  return copied;
}
async function verifyOne(name, src, dst, fields) {
  let count=0;
  for await (const raw of src.collection(name).find({}, {batchSize:200})) {
    const expected=projection(raw,fields);
    const actual=await dst.collection(name).findOne({_id:raw._id});
    if (!isDeepStrictEqual(expected,actual)) throw new Error(`Data drift: ${name} _id=${raw._id} dst=${dst.databaseName}`);
    count++;
  }
  const dstCount=await dst.collection(name).countDocuments({});
  if (dstCount!==count) throw new Error(`Count mismatch: ${name} in ${dst.databaseName}: ${dstCount} vs ${count}`);
  return count;
}
try {
  const names = (await source.listCollections({},{nameOnly:true}).toArray()).map(c=>c.name).filter(n=>!n.startsWith('system.'));
  const unknown=names.filter(n=>!ownerOf.has(n) && !schema.ignoredLegacyCollections.includes(n));
  if (names.includes('domain_outbox') && await source.collection('domain_outbox').countDocuments({state:{$nin:['delivered','published','done']}})) {
    throw new Error('Legacy domain_outbox has unpublished events; reconcile before importing.');
  }
  if (unknown.length) throw new Error(`Unmapped legacy collections: ${unknown.join(', ')}. Add explicit owner before import.`);
  console.log('Legacy import',mode,'from',configuredLegacyDbName,'collections',names.length,'mapping sha256',importManifestChecksum);
  if (mode === 'apply') {
    if(!names.some(n=>ownerOf.has(n))) throw new Error('Legacy staging DB has no mapped documents. Check the dump format and source namespace.');
    const existingMarkers = [];
    for (const [role, db] of Object.entries(targets)) {
      if (await db.collection('import_history').findOne({_id:'legacy_import_v1'})) existingMarkers.push(role);
    }
    if(existingMarkers.length) throw new Error(`Legacy import already completed on: ${existingMarkers.join(', ')}. Never run --apply twice. Verify/recover from backup instead.`);
  }
  if (mode === 'plan') {
    console.log('PLAN only: no writes. All new service DBs must have been initialized and legacy source must be imported into the staging database.');
    for (const name of names.filter(n=>ownerOf.has(n)).sort()) {
      console.log(name,'->',ownerOf.get(name),'(+projections to',Object.keys(schema.projections[name]||{}).join(',')||'none',')',await source.collection(name).estimatedDocumentCount());
    }
  } else {
    if (mode === 'apply') {
      // A newly booted installation creates these two system defaults through
      // OnModuleInit. They are NOT user records. The legacy snapshot owns their
      // stable IDs and settings after an explicitly confirmed import.
      const generatedDefaults = {
        gamedefinitions: {role:'learning', field:'code', allowed:['TYPING_RUSH','MEANING_TYPING','WORD_SHOOTER']},
        arenasettings: {role:'arena', field:'key', allowed:['global']}
      };
      for (const [collection, cfg] of Object.entries(generatedDefaults)) {
        if (!names.includes(collection)) continue;
        const target = targets[cfg.role].collection(collection);
        const present = await target.find({}).toArray();
        const allowed = new Set(cfg.allowed);
        if (present.some(doc => !allowed.has(doc[cfg.field]))) {
          throw new Error(`Import refused: ${cfg.role}.${collection} contains non-default records. Back up new writes before any import.`);
        }
        if (present.length) {
          console.log(`Replacing ${present.length} generated defaults in ${cfg.role}.${collection} with legacy source records`);
          await target.deleteMany({[cfg.field]:{$in:cfg.allowed}});
        }
      }
    }
    for (const name of names.filter(n=>ownerOf.has(n)).sort()) {
      const owner=ownerOf.get(name);
      const destinations=[[owner,'*'],...Object.entries(schema.projections[name]||{})];
      for (const [role, fields] of destinations) {
        const db=targets[role];
        if (mode === 'apply') {
          const n=await copyOne(name,source,db,fields);
          console.log('COPIED',name,'->',role,n);
        }
        const verified=await verifyOne(name,source,db,fields);
        console.log('VERIFIED',name,'->',role,verified);
      }
    }
    if (mode === 'apply') {
      // All import receipts commit atomically. The application has already booted
      // on clean, independently owned databases; this import never changes schema.
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          for (const [role,db] of Object.entries(targets)) {
            await db.collection('import_history').updateOne(
              {_id:'legacy_import_v1'},
              {$set:{version:1,role,importManifestChecksum,completedAt:new Date(),sourceDb:configuredLegacyDbName}},
              {upsert:true,session},
            );
          }
        }, {writeConcern:{w:'majority'}});
      } finally { await session.endSession(); }
      console.log('SUCCESS: legacy data imported and verified into independently owned service databases.');
    } else {
      for (const [role,db] of Object.entries(targets)) {
        const marker=await db.collection('import_history').findOne({_id:'legacy_import_v1'});
        if (!marker || marker.importManifestChecksum !== importManifestChecksum) throw new Error(`Missing/stale import receipt: ${role}`);
      }
      console.log('SUCCESS: all imported documents and receipts verified');
    }
  }
} finally {
  await Promise.all([sourceConn.close(),targetConn.close()]);
}
