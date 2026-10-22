# Import old MongoDB `.dump` into a freshly built Microservices stack

**Never required for `docker compose up -d --build`.** Backups remain untouched.
The importer does **not** create databases, indexes or accounts from scratch.
`db-init` already created the new schema.

Supported files:

- `mongodump --archive=D:\english-platform.dump` (raw MongoDB archive)
- `mongodump --archive=... --gzip` (gzip archive, regardless of filename extension)

A `mongodump` **BSON collection dump** or a directory tree is different from
`--archive` output. This script will stop at `mongorestore --dryRun` if the file is
not a valid archive. A `.sha256` sidecar is optional; if present, it must match.

## 1. Bootstrap fresh application

```powershell
docker compose up -d --build
```

This produces empty `identity_db`, `content_db`, `assessment_db`, `arena_db`,
`learning_db`, `media_db`, `ai_import_db`, and `notification_db`.

## 2. Inspect backup and import PLAN (does not modify business databases)

```powershell
.\scripts\import-legacy-dump.ps1 -Dump 'D:\english-platform.dump'
```

The script calculates/verifies SHA256; detects gzip from file bytes; copies the
archive into the Mongo container; tests `mongorestore --dryRun`; **restores only
into staging `legacy_import`** by remapping the `english-platform.*` namespace;
then shows each source collection's owning service and expected counts.

`legacy_import` is deliberately separate. If `--plan` detects an unknown collection,
stop and inspect `database/import/ownership.json`; never silently discard the data.

## 3. Apply once, with explicit confirmation

```powershell
.\scripts\import-legacy-dump.ps1 -Dump 'D:\english-platform.dump' -Apply
```

The script checks the staging archive fingerprint; asks you to type `IMPORT`;
stops business containers (leaves Mongo, RabbitMQ, Redis and object store);
copies the documents into the eight *owned service databases* and their read models;
replaces only newly auto-generated minigame/Arena configuration seeds when a corresponding legacy collection exists; verifies exact fields and counts; and writes `import_history` records. It never
runs `dropDatabase`, `--drop`, or `down --volumes`.

If an import fails partway, **do not resume production writes**. Resolve the error
and rerun on a clean target/restore; do not remove any backup. The import writes
are idempotent for identical source documents but conflicting records are rejected.

## 4. Restart the application

```powershell
docker compose up -d --no-build
```

Verify migrated Auth, TOEIC, Vocabulary, Dictation, Arena and learning history.

## Important media limitation

`.dump` includes **MongoDB documents only**. It does not contain local audio,
images, uploaded PDFs, S3 media or AI model files. Backup/migrate those separately
before deleting their source volumes or directories. Media storage now uses
SeaweedFS through an S3-compatible adapter.
