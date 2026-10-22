/**
 * Additive MongoDB schema reconciliation for the Compose db-init one-shot job.
 *
 * The manifest describes the desired collections, non-blocking validators and
 * indexes. Re-running creates missing objects and refreshes warning validators;
 * it NEVER drops collections, indexes or documents, rewrites user documents,
 * or resets the initial change-stream timestamp.
 *
 * Incompatible index changes/duplicate values fail clearly rather than deleting
 * data or reporting an incomplete migration as successful.
 */
const fs = require('fs');
const crypto = require('crypto');
const bytes = fs.readFileSync('/bootstrap/schema/collections.json');
const manifest = JSON.parse(bytes.toString('utf8'));
const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
const version = Number(manifest.schemaVersion);
if (!Number.isInteger(version) || version < 1) throw new Error('Invalid schemaVersion in collections.json');
const replicaName = 'rs0';
const replicaHost = 'mongo:27017';
const admin = db.getSiblingDB('admin');

function requireOk(result, operation) {
  if (result.ok !== 1) throw new Error(`${operation}: ${JSON.stringify(result)}`);
}

// Compare BSON-compatible JSON Schema definitions without depending on key order.
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = normalize(value[key]);
    return result;
  }
  return value;
}
function same(a, b) { return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b)); }
function schemaFor(spec) {
  const bson = {bsonType: 'object', properties: {}};
  for (const [field, def] of Object.entries(spec.fields || {})) {
    const types = {
      objectId: ['objectId', 'null'],
      date: ['date', 'null'],
      bool: ['bool', 'null'],
      number: ['int', 'long', 'double', 'decimal', 'null'],
      string: ['string', 'null'],
      array: ['array', 'null']
    }[def.type];
    if (types) bson.properties[field] = {bsonType: types};
  }
  return {$jsonSchema: bson};
}

// MongoDB 8 can start with --replSet but without an initialized config.
// `hello` distinguishes this from an existing replica set without causing
// NotYetInitialized failures.
const initialHello = admin.runCommand({hello: 1});
requireOk(initialHello, 'Read MongoDB hello');
if (initialHello.isreplicaset === true && !initialHello.setName) {
  print('[db-init] Fresh MongoDB replica set detected; initializing rs0...');
  try {
    requireOk(admin.runCommand({
      replSetInitiate: {_id: replicaName, members: [{_id: 0, host: replicaHost}]}
    }), 'Initialize rs0');
  } catch (error) {
    if (error.codeName !== 'AlreadyInitialized' && error.code !== 23) throw error;
  }
} else if (initialHello.setName === replicaName) {
  print('[db-init] Existing rs0 found; waiting for PRIMARY...');
} else {
  throw new Error(`Expected rs0 (or fresh --replSet rs0), got hello: ${JSON.stringify(initialHello)}`);
}

let primary = false;
for (let i = 0; i < 120; i++) {
  const hello = admin.runCommand({hello: 1});
  if (hello.ok === 1 && hello.isWritablePrimary && hello.setName === replicaName) {
    primary = true;
    break;
  }
  if (i % 15 === 0) print('[db-init] Waiting for rs0 primary election...');
  sleep(1000);
}
if (!primary) throw new Error('MongoDB did not elect a PRIMARY in 120 seconds');

const configResult = admin.runCommand({replSetGetConfig: 1});
requireOk(configResult, 'Read initialized replica-set configuration');
const cfg = configResult.config;
if (cfg._id !== replicaName || cfg.members.length !== 1 || cfg.members[0].host !== replicaHost) {
  throw new Error('Existing MongoDB replica set does not match rs0/mongo:27017; manual review required.');
}
print('[db-init] MongoDB PRIMARY is ready');

for (const [role, name] of Object.entries(manifest.databases)) {
  const database = db.getSiblingDB(name);
  const versions = database.getCollection('database_versions');
  const baseline = versions.findOne({_id: 'initial_schema_v1'});
  const current = versions.findOne({_id: 'schema_manifest_current'});
  // Never silently reinterpret an existing database as belonging to another service.
  if ((baseline && baseline.role !== role) || (current && current.role !== role)) {
    throw new Error(`Database ownership mismatch: ${name} must belong to ${role}`);
  }
  if (current && current.schemaVersion > version) {
    throw new Error(`Refusing schema downgrade for ${name} from v${current.schemaVersion} to v${version}`);
  }
  const changed = !current || current.schemaChecksum !== checksum || current.schemaVersion !== version;
  let created = 0, validators = 0, indexes = 0;

  for (const [collectionName, spec] of Object.entries(manifest.collections[role] || {})) {
    const validator = schemaFor(spec);
    const existing = database.getCollectionInfos({name: collectionName});
    if (!existing.length) {
      requireOk(database.runCommand({
        create: collectionName, validator,
        validationAction: 'warn', validationLevel: 'moderate'
      }), `Create ${name}.${collectionName}`);
      created++;
    } else {
      if (existing[0].type !== 'collection') {
        throw new Error(`Expected collection, got ${existing[0].type}: ${name}.${collectionName}`);
      }
      const opts = existing[0].options || {};
      if (!same(opts.validator, validator) || opts.validationAction !== 'warn' || opts.validationLevel !== 'moderate') {
        requireOk(database.runCommand({
          collMod: collectionName, validator,
          validationAction: 'warn', validationLevel: 'moderate'
        }), `Reconcile validator ${name}.${collectionName}`);
        validators++;
      }
    }
    for (const entry of spec.indexes || []) {
      try {
        // MongoDB createIndex is idempotent for an identical index. Existing
        // indexes not in the manifest are intentionally NOT dropped.
        database.getCollection(collectionName).createIndex(entry.key, entry.options || {});
        indexes++;
      } catch (error) {
        throw new Error(`Cannot merge index on ${name}.${collectionName} ${JSON.stringify(entry.key)}. ` +
          `Resolve duplicate data or incompatible index options manually; no documents were deleted. ${error.message}`);
      }
    }
  }

  // Initial marker is immutable: relays must NOT lose their original starting
  // point if a new schema is published before their first successful resume.
  if (!baseline) {
    const hello = admin.runCommand({hello: 1});
    requireOk(hello, 'Find initial change-stream timestamp');
    const start = hello.operationTime || (hello.$clusterTime && hello.$clusterTime.clusterTime);
    if (!start) throw new Error('MongoDB oplog timestamp unavailable');
    versions.updateOne({_id: 'initial_schema_v1'}, {$setOnInsert: {
      _id: 'initial_schema_v1', role, schemaVersion: version,
      schemaChecksum: checksum, projectionStartTime: start, initializedAt: new Date()
    }}, {upsert: true});
  } else if (!baseline.projectionStartTime) {
    throw new Error(`Missing immutable projectionStartTime in ${name}; manual repair required`);
  }

  // The mutable marker is used by NestJS and projection workers to assert
  // that the exact manifest bundled in their image has been reconciled.
  versions.updateOne({_id: 'schema_manifest_current'}, {
    $set: {role, schemaVersion: version, schemaChecksum: checksum, appliedAt: new Date()}
  }, {upsert: true});
  print(`[db-init] ${name}: ${created} collections created, ${validators} validators updated, ` +
    `${indexes} indexes checked; ${changed ? 'merged' : 'verified'} schema v${version}`);
}
print('[db-init] SUCCESS: all service databases reconciled without deleting data.');
