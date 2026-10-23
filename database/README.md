# Database — additive MongoDB schema synchronization

Each service owns a **separate MongoDB database** (eight logical databases in the
local single-node `rs0` cluster). The desired collections, field *warning*
validators and indexes live in [`schema/collections.json`](schema/collections.json).
Application-level Mongoose schemas remain responsible for defaults, nested
validation and business constraints.

`docker compose up -d --build` builds the `db-init` image from
[`Dockerfile`](Dockerfile). Because the manifest and script are COPYed into this
image, changing either file causes Compose to rebuild/recreate the one-shot job.
The other containers declare `depends_on: db-init: service_completed_successfully`,
so on fresh startup and image recreation they wait for reconciliation.

## What reconciliation does

1. Initializes or verifies the single-node MongoDB replica set `rs0`.
2. Creates missing collections and their indexes; **does not drop any collection
   or existing index**.
3. Compares each existing collection's validator to the manifest and applies
   `collMod` when necessary, always with `validationAction: warn` and
   `validationLevel: moderate`; old documents are neither deleted nor rejected.
4. Verifies/recreates declared indexes via idempotent `createIndex`.
5. On first initialization, inserts immutable `initial_schema_v1` with the
   original `projectionStartTime`. Never overwrites its checksum/timestamp.
6. Writes the latest schema checksum/version to `schema_manifest_current`.
   NestJS services and projection workers validate *this* marker against their
   image's bundled manifest. The relay still starts from the immutable
   `initial_schema_v1.projectionStartTime` (or its persisted resume token).

Existing documents are **not rewritten**. Newly added optional fields are
available to subsequent writes but are not backfilled in old documents.
Field renames, type conversions, data backfills, uniqueness conflicts, destructive
index alterations and cross-service data ownership moves **require an explicit,
reviewed migration**, rather than a blind automatic overwrite.

A new unique index with duplicate data, or an incompatible existing index,
causes a clear `db-init` failure. The job does not delete data or mark the
schema as current if an index operation fails. Fix the conflict and rerun.
Reconciliation may be partly applied before an error; operations are idempotent.

If you suspect database drift without any source/schema change and want to force
an immediate comparison, run:

```powershell
docker compose up -d --force-recreate db-init
docker compose up -d --build
```

Do not use `docker compose down -v` or `docker system prune --volumes` as a
migration mechanism. Back up before changing a deployed schema.

## Import from the old monolith

[`import/ownership.json`](import/ownership.json) maps legacy collections to the
service-owned databases and read-model projections. That import is a **manual,
separate operation**; it never runs during normal Compose startup.
See [`../IMPORT_LEGACY_DUMP.md`](../IMPORT_LEGACY_DUMP.md).
