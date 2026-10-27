# PostgreSQL Service Ownership

Each backend role owns exactly one of the eight PostgreSQL databases defined in `database/postgres/01-init.sql`. Cross-service reads/writes must go through authenticated HTTP or domain events. Each database has `outbox_events` and `inbox_events` for reliable RabbitMQ handling.

Cross-service query pages and counts can now use authenticated owner SQL contracts:
`POST /api/_internal/read-models/:table/query` (filter, indexed-column sort, required limit 1..2000, offset)
and `POST /api/_internal/read-models/:table/count` (filter). They accept **structured,
parameterized filters only**, never caller-supplied SQL. Unsupported filters return 422
and the caller temporarily uses the legacy compatibility endpoint. `apps/api/src/postgres/ownership.ts`
declares ownership; callers never receive another service's database credentials.
The endpoint accepts only owned business tables, excludes admin credentials and PDF
correction payloads, and removes user authentication secrets. Query/count on `users`
are restricted to public identity projection columns. The public gateway blocks
all internal endpoints. Foreign writes still require an owner command API.

**Migration caveat:** The existing authenticated `GET /api/_internal/read-models/:table`
remains available to complex aggregation/lookup consumers and can still return a full
snapshot. Migrate those callers to bounded owner-specific DTO APIs or event-fed local
projections before removing it. Arena/Learning/Notification continue using their
local `identity_profiles` projection instead of calling Identity synchronously.


`database/postgres/01-init.sql` bootstraps fresh installations only. On existing volumes, `scripts/repair-postgres-docker.ps1` adds Assessment's missing PDF correction outbox and removes erroneous root NOT NULL requirements inherited from embedded Content/Arena schemas. It retains all columns and rows. Word parts belong in `parts` JSONB, dictation word timings in `words` JSONB, and member/option data in their parent JSONB arrays. Required fields of an embedded object must not become required columns of its parent. `tests/schema-contracts.cjs` checks this contract. Assessment and AI Import retain separate correction records in their respective databases. No legacy database driver is used.

The audio worker declares `SERVICE_ROLE=audio-worker` and owns only `media_db`. AudioProcessingService reads Content/Assessment over the read API and submits narrow updates through `/api/_internal/content/audio/words/:id` or `/api/_internal/assessment/audio/{questions,passages}/:id`. It does not update foreign SQL tables or install global model hooks. The receiving owner permits only audio fields.

Validate a running Docker stack with `docker compose exec -T identity-service node scripts/smoke-postgres-stack.mjs`. It uses an existing active user and administrator, checks the previously failing routes, internal-route isolation, and Socket.IO transport. It never prints credentials or access tokens. Arena's profile GET may initialize the selected user's profile.

Run `tests/postgres-write-flows.mjs` in Content and Assessment to check populated write/query flows with database rollback. `scripts/smoke-write-audio.mjs` runs in Identity and exercises word creation, group IDs/counts, real TTS, RabbitMQ audio jobs and dictation audio through the gateway. Its isolated fixtures are deleted through owner APIs (soft deletion where the API uses it), and generated media is removed. Completed job history remains in Media.

Dictation's `completed_segments` and `revealed_segments`, and Arena's UUID lists, are JSONB arrays. Existing scalar columns are converted by the repair scripts, preserving lists from the legacy JSONB payload when present. Re-running repairs retains existing arrays. The schema contract check also rejects scalar numeric/UUID columns for array entity fields.

The document adapter treats `.select('+questionSnapshot')` as an additive field override, preserving the rest of the attempt. A genuinely absent snapshot still returns a conflict; it is never rebuilt from an edited exam. Attempt updates and update pipelines lock the current PostgreSQL row within a transaction and recheck their conditions after acquiring the lock. `tests/postgres-attempt-concurrency.mjs` verifies parallel answer saves, duplicate-answer rejection and concurrent submission with fixture cleanup.
