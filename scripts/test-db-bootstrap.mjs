#!/usr/bin/env node
// In-memory mongosh mock: first boot, idempotence, drift repair, manifest merge,
// historical checkpoint preservation and safe failure on conflicting indexes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const bootstrap = readFileSync(resolve(root, 'database/init.js'), 'utf8');
const originalBytes = readFileSync(resolve(root, 'database/schema/collections.json'));
const manifest = JSON.parse(originalBytes);
let activeBytes = originalBytes;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const databases = new Map();
let initialized = false;
let tick = 10;
let validatorUpdates = 0;

function collectionMap(databaseName) {
  if (!databases.has(databaseName)) databases.set(databaseName, new Map());
  return databases.get(databaseName);
}
function getDB(name) {
  const collections = collectionMap(name);
  function ensure(coll) {
    if (!collections.has(coll)) {
      collections.set(coll, {docs: new Map(), indexes: new Map(),
        options: {}, type: 'collection'});
    }
    return collections.get(coll);
  }
  function getCollection(coll) {
    return {
      findOne(filter) {
        const record = collections.get(coll)?.docs.get(filter._id);
        if (!record) return null;
        return Object.entries(filter).every(([key, value]) => record[key] === value) ? {...record} : null;
      },
      updateOne(filter, cmd) {
        const x = ensure(coll);
        const old = x.docs.get(filter._id);
        if (!old && !cmd.$setOnInsert && !cmd.$set) throw Error('Invalid update');
        const record = old ? {...old} : {_id: filter._id};
        if (!old && cmd.$setOnInsert) Object.assign(record, cmd.$setOnInsert);
        if (cmd.$set) Object.assign(record, cmd.$set);
        x.docs.set(filter._id, record);
      },
      createIndex(key, options = {}) {
        const x = ensure(coll);
        const id = JSON.stringify(key);
        const old = x.indexes.get(id);
        if (old && JSON.stringify(old) !== JSON.stringify(options)) {
          throw Error('IndexOptionsConflict');
        }
        if (options.unique && !old) {
          const seen = new Set();
          for (const record of x.docs.values()) {
            const value = JSON.stringify(Object.keys(key).map(k => record[k] ?? null));
            if (seen.has(value)) throw Error('E11000 duplicate key error');
            seen.add(value);
          }
        }
        x.indexes.set(id, options);
      }
    };
  }
  return {
    getCollectionInfos(filter) {
      const x = collections.get(filter.name);
      return x ? [{name:filter.name, type:x.type, options:x.options}] : [];
    },
    getCollectionNames() { return [...collections.keys()]; },
    getCollection,
    runCommand(cmd) {
      if (cmd.create) {
        if (collections.has(cmd.create)) throw Error('Collection already exists: '+cmd.create);
        const x = ensure(cmd.create);
        x.options = {validator:cmd.validator, validationAction:cmd.validationAction,
          validationLevel:cmd.validationLevel};
        return {ok:1};
      }
      if (cmd.collMod) {
        const x = collections.get(cmd.collMod);
        if (!x) throw Error('Collection missing: '+cmd.collMod);
        x.options = {validator:cmd.validator,validationAction:cmd.validationAction,
          validationLevel:cmd.validationLevel};
        validatorUpdates++;
        return {ok:1};
      }
      if (cmd.replSetGetConfig) return initialized ?
        {ok:1,config:{_id:'rs0',members:[{host:'mongo:27017'}]}} :
        {ok:0,code:94,codeName:'NotYetInitialized'};
      if (cmd.replSetInitiate) { initialized = true; return {ok:1}; }
      if (cmd.hello) return initialized ?
        {ok:1,isWritablePrimary:true,setName:'rs0',operationTime:{time:tick++,inc:1}} :
        {ok:1,isreplicaset:true,isWritablePrimary:false};
      return {ok:0,errmsg:'Unknown command'};
    }
  };
}
function runBootstrap() {
  const sandbox = {
    db:{getSiblingDB:getDB},
    require(name) {
      if (name === 'fs') return {readFileSync(path) {
        if (path !== '/bootstrap/schema/collections.json') throw Error(path);
        return activeBytes;
      }};
      if (name === 'crypto') return {createHash};
      throw Error('Unsupported require '+name);
    },
    print() {}, sleep() {}
  };
  vm.runInContext(bootstrap, vm.createContext(sandbox), {timeout:10000});
}
function assert(ok, reason) { if (!ok) throw Error(reason); }
function getMarker(role, id) {
  return databases.get(manifest.databases[role])?.get('database_versions')?.docs.get(id);
}

runBootstrap();
const count = [...databases.values()].reduce((n,m)=>n+m.size,0);
const expectedCount = Object.values(manifest.collections)
  .reduce((n, collections)=>n+Object.keys(collections).length, 0);
assert(count === expectedCount, `Wrong collection count ${count}/${expectedCount}`);
const firstBaseline = getMarker('identity','initial_schema_v1');
const baselineTime = firstBaseline.projectionStartTime;
assert(firstBaseline.schemaChecksum===hash(originalBytes), 'Wrong baseline checksum');
assert(getMarker('identity','schema_manifest_current').schemaChecksum===hash(originalBytes),
  'Wrong current checksum after fresh install');

runBootstrap();
assert(validatorUpdates === 0, 'Repeat without schema changes modified validators');
assert(getMarker('identity','initial_schema_v1').projectionStartTime===baselineTime,
  'Idempotent run changed stream start');

// A deliberately missing collection is recreated even if checksum did not change.
const firstIdentityCollections = databases.get('identity_db');
const removed = firstIdentityCollections.get('import_history');
firstIdentityCollections.delete('import_history');
runBootstrap();
assert(firstIdentityCollections.has('import_history'), 'Did not repair missing collection');

// Keep old documents, add a collection, add a field and update an existing
// warning validator. The immutable initial_schema_v1 marker must not change.
const userCollection = firstIdentityCollections.get('users');
userCollection.docs.set('user-demo', {_id:'user-demo',email:'demo@example.test',legacyField:'keep'});
const changed = JSON.parse(originalBytes);
changed.collections.identity.users.fields.newOptionalField = {type:'string',required:false};
changed.collections.identity.newfeature = {fields:{title:{type:'string'}},indexes:[{key:{title:1},options:{}}]};
activeBytes = Buffer.from(JSON.stringify(changed));
runBootstrap();
assert(firstIdentityCollections.has('newfeature'), 'Merge did not create new collection');
assert(validatorUpdates>0, 'Merge did not update validator');
assert(userCollection.docs.get('user-demo').legacyField === 'keep', 'Existing document was overwritten');
assert(getMarker('identity','initial_schema_v1').schemaChecksum===hash(originalBytes),
  'Immutable historical schema checksum changed');
assert(getMarker('identity','initial_schema_v1').projectionStartTime===baselineTime,
  'Merge reset projectionStartTime');
assert(getMarker('identity','schema_manifest_current').schemaChecksum===hash(activeBytes),
  'Merged current marker checksum is wrong');
const once = validatorUpdates;
runBootstrap();
assert(validatorUpdates === once, 'Repeat of merged schema updated validators');

// A new unique index encountering duplicate data must fail without deleting
// documents or advancing the current marker.
userCollection.docs.set('another-user', {_id:'another-user',email:'other@example.test',duplicated:'same'});
userCollection.docs.get('user-demo').duplicated = 'same';
const invalid = structuredClone(changed);
invalid.collections.identity.users.indexes.push({key:{duplicated:1},options:{unique:true}});
activeBytes = Buffer.from(JSON.stringify(invalid));
let failed = false;
try {runBootstrap();} catch(error) {
  failed = String(error).includes('Cannot merge index') && String(error).includes('duplicate');
}
assert(failed, 'Conflicting unique index did not fail safely');
assert(userCollection.docs.size===2, 'Index conflict destroyed documents');
assert(getMarker('identity','schema_manifest_current').schemaChecksum===hash(Buffer.from(JSON.stringify(changed))),
  'Failure should not advance current schema marker');

console.log(`PASS: ${Object.keys(manifest.databases).length} databases, ${expectedCount} collections; `+
  'fresh boot, repeat, drift repair, additive merge, immutable checkpoints, and safe index conflicts');
