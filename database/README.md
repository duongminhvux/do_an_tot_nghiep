# Database migrations (MongoDB)

MongoDB does not use SQL CREATE TABLE statements. NestJS Mongoose `*.schema.ts` remain the
runtime schema/validation definitions. `database/migrations` contains **append-only**,
numbered, reviewed, idempotent database changes and indexes. Never rewrite an applied migration.

## Usage

1. Back up DB first: `bash scripts/backup-mongo.sh`.
2. Preview: `docker compose run --rm db-migrate node apps/api/src/scripts/db-migrate.mjs --dry-run`.
3. Apply: `docker compose run --rm db-migrate` (or run as part of `up`).
4. Seed initial admin explicitly: `docker compose exec api pnpm --filter api seed:admin`.

On deployment the `db-migrate` one-shot service runs before API. If an applied migration
checksum changed or the DB contains a migration newer than this code, startup stops.
No implicit `dropIndex()`, automatic `syncIndexes()` or default-admin creation runs at API startup.

**Important:** `0001_baseline_collections` is an additive baseline, not a complete inventory
of every collection in the app. Mongoose can still create missing collections on first
write; before moving to production-grade schema governance, audit and add the rest of the
collections and index declarations as reviewed migrations. Auto-index remains enabled in the existing
NestJS HTTP API by default for compatibility while the migration inventory is incomplete.
Set `MONGOOSE_AUTO_INDEX=false` only after indexes have been fully audited and migrated.
The isolated Audio Worker does not create indexes. Existing indexes are preserved. Existing duplicate/legacy indexes
must be reconciled with explicit migrations, not forcibly dropped at runtime.

For multiple deployment runners, use a database migration deployment lock / single CI job.
The supplied Compose `db-migrate` is intended to be a single one-shot instance.

`schema-manifest.json` currently inventories and hashes all 42 module Mongoose schema files,
so accidental schema changes are detected before applying migrations. The manifest
is an audit index, **not yet a complete SQL-style schema snapshot or full index set**.
After editing any `*.schema.ts`, review the diff, author a numbered migration if the
DB needs to change, then regenerate the manifest with the maintainer script; never
silently rewrite applied migration files.
