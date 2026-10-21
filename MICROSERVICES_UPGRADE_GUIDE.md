# Microservices migration — safe rollout (project 2026-10-21)

> **Status: transition branch, not full microservices.** The full business NestJS API
> remains operational. This release delivers database migration/backup tooling, optional
> MinIO media adapter, RabbitMQ audio bulk queue with an isolated worker process, model
> initialization, and an Admin Worker/Queue screen. Identity, Assessment, Content,
> Progress, Arena and PDF-AI have **not** yet been split into fully independent
> database-owning services. Other pending work is documented below.

## A. Back up existing data BEFORE merging/deploying

**Windows PowerShell (recommended):**

```powershell
# From repository root while the CURRENT Mongo container is still running:
.\scripts\backup-mongo.ps1 -DbName "english-platform"
# For safe restore on a test server:
.\scripts\restore-mongo.ps1 -Backup "backups/mongodb/<your-file>.archive.gz"
```

**Linux / Git Bash:**

```bash
MONGO_DB_NAME=english-platform bash scripts/backup-mongo.sh
# Restore is interactive, NO --drop flag:
MONGO_DB_NAME=english-platform bash scripts/restore-mongo.sh backups/mongodb/<file>.archive.gz
```

Scripts intentionally do not drop databases and should never replace a proper verified,
consistent production backup. A filesystem backup of `./storage` is also required **before**
MinIO migration. Export `.env` securely (it is excluded from the delivered ZIP).
Never commit or share backups, app secrets, or raw audio containing personal data.

## B. First run: keep existing behavior

1. Keep YOUR original root `.env`. The artifact intentionally omits `.env`.
2. Review `.env.example` for new variables; do not copy placeholder secrets into production.
3. Inspect migration plan, then start:

```powershell
docker compose build api
docker compose run --rm db-migrate node apps/api/src/scripts/db-migrate.mjs --dry-run
docker compose up --build
```

`db-migrate` executes once and finishes before API startup. Its versions/checksums are
recorded in Mongo `schema_migrations`. Existing data is kept; MongoDB schema is still
expressed as Mongoose class definitions, not SQL tables. During the transition,
`MONGOOSE_AUTO_INDEX=true` remains the compatible default so unmigrated unique indexes
are not silently omitted. Switch it off only after auditing all schema indexes. Collection/index migration is
**not yet a complete snapshot of every model in the repository**. A conflicting legacy
unique index may require an explicit data cleanup/DB migration; do not use `--drop` blindly.

Mongo collection/index declarations are inventoried in `database/schema-manifest.json`
(42 source files). A schema change without updating the manifest aborts migration.
When you intentionally update a schema, write a new numbered migration, run
`python scripts/generate-schema-manifest.py`, and review the resulting diff.

Creation of the initial admin is now **manual** (no implicit default admin on each API
startup). On a brand-new DB, set a strong `DEFAULT_ADMIN_PASSWORD` and then run:

```powershell
docker compose exec api pnpm --filter api seed:admin
```

## C. Optional S3/MinIO transition

Populate strong, distinct secrets in `.env`:

```dotenv
S3_ACCESS_KEY=your_nondefault_key
S3_SECRET_KEY=long_random_secret
MEDIA_INTERNAL_TOKEN=long_random_secret_at_least_24_chars
MEDIA_STORAGE_BACKEND=s3
S3_ENDPOINT=http://127.0.0.1:9000  # for local host migration script only
```

Run from root:

```powershell
docker compose -f docker-compose.yml -f infra/compose/storage.yml up -d --build
```

New `MediaStorageService` writes go to MinIO through a private S3 bridge; legacy media
in `./storage` remains available via the existing URL fallback. MinIO console is bound
to `127.0.0.1:9001`, object API to `127.0.0.1:9000` (not public). For migrating local
files, install Python boto3 on the host and run `python scripts/migrate-media-to-s3.py`
first **without** `--apply`, then with `--apply`; it refuses to overwrite an object whose
checksum is unknown or different, and NEVER deletes local originals.

**Not migrated:** image flows still using Cloudinary or other direct providers, PDF-AI's
legacy local learning files, and the `assetId` references in every domain schema.
The S3 adapter uses object keys + existing media URLs; media_assets collection/index is
prepared, but full asset catalog migration remains to be done. Do not discard old media
or remove the local volume yet. The bridge is private and should not be exposed online.

## D. Optional RabbitMQ audio bulk queue (keep Redis)

Set strong `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_URL`, `JOB_INTERNAL_TOKEN`
(>=24 characters). URL-encode any special characters in password when constructing
`RABBITMQ_URL`. Example URL shape:

```dotenv
RABBITMQ_URL=amqp://USER:URL_ENCODED_PASSWORD@rabbitmq:5672/%2F
JOB_INTERNAL_TOKEN=generate_a_long_random_internal_token
```

Run:

```powershell
# With existing local media:
docker compose -f docker-compose.yml -f infra/compose/rabbitmq.yml up -d --build

# With MinIO as well: set MEDIA_STORAGE_BACKEND=s3 before using all three overlays.
docker compose -f docker-compose.yml -f infra/compose/rabbitmq.yml -f infra/compose/storage.yml up -d --build
```

The **existing bulk endpoints** (`POST /api/admin/audio/vocabulary/bulk` and TOEIC exam
bulk generate) create a job in Redis, publish to RabbitMQ, and return jobId. An isolated
Nest `audio-worker` runs the existing generation service, and the Python Rabbit runner
uses manual ACK after success; failures route through retry and a dead-letter queue.
The Admin job status endpoint is unchanged, so existing progress polling works.

- Worker management page: `/{locale}/infrastructure` in Admin.
- RabbitMQ Management: `http://127.0.0.1:15672` (operator access only).
- Redis still serves Arena/Socket.IO and the **transitional** 7-day audio-job status.
- **New async endpoints:** `POST /api/admin/audio/vocabulary/:id/enqueue`,
  `POST /api/admin/audio/toeic/questions/:id/enqueue`, and
  `POST /api/admin/audio/toeic/passages/:id/enqueue`. These return `jobId`.
  The original per-item `Generate` endpoints are still synchronous for frontend
  compatibility; Admin UI can migrate to the async endpoints in a follow-up.
- Redis List mode remains default if RabbitMQ overlay is omitted.

### Worker 2 (experimental / operator opt-in)

`infra/compose/elastic-worker.yml` provisions a second Kokoro inference process +
secondary Nest worker + Rabbit runner. **Do not enable on a single 8GB GPU without
benchmarking.** In Admin set `maxWorkers=2`, then set `GPU_ALLOW_SECONDARY=true`
and start the optional overlay. The runner checks backlog and reported free VRAM before
claiming messages; if `nvidia-smi` is unavailable, it fails closed. The optional second
Kokoro container is **not** automatically cold-started or unloaded on demand; a proper
host scheduler/Kubernetes scale controller is still required. More workers do not
necessarily mean more throughput.

Qwen remains restricted to `max_workers=1` in `pdf-ai`, and Ollama in
`docker-compose.ai.yml` uses `OLLAMA_NUM_PARALLEL=1`. PDF-AI and ASR **do not yet use
RabbitMQ**; their migration is future work.

## E. Optional model preflight + Qwen pull

```powershell
docker compose -f docker-compose.yml -f infra/compose/model-init.yml up -d --build
# For Qwen: include docker-compose.ai.yml AND the Ollama init overlay
docker compose -f docker-compose.yml -f docker-compose.ai.yml -f infra/compose/ollama-init.yml up -d --build
```

Model caches live in persistent `kokoro_models`, `whisper_models`, `ollama_models`.
Models are checked/downloaded at **container startup**, not `docker build`. The image
still contains Python/Node, CUDA/torch dependencies and application code, but no weights.
`MODEL_AUTO_DOWNLOAD=false` makes the preflight fail if the expected model is absent.

## F. Two-server deployment target (not yet enabled automatically)

Keep MongoDB, Redis, RabbitMQ, MinIO, business APIs and Frontends on Server A. Put
Kokoro/Whisper/Ollama and job consumer/worker processes on GPU Server B, connect over
private WireGuard/Tailscale or similar. Worker connects outbound to RabbitMQ, media over
private S3 API; model volumes stay local to each GPU host. Do NOT expose Redis,
RabbitMQ AMQP, MongoDB, model HTTP services or S3 admin endpoints publicly.

Existing Compose still starts the base `tts-service` and `asr-service` on Server A; a
clean two-host stack needs split deployment manifests, consistent service discovery,
secure credentials/TLS and end-to-end health checks. Do not assume copying the existing
Compose files to B is enough.

## G. Required remaining work before claiming complete microservices

1. Audit all Mongoose schema/index definitions and author versioned, additive migrations
   for the complete data model (the current baseline covers only some collections/indexes).
2. Implement stable media asset IDs in all Word/TOEIC/Dictation/image/PDF schemas; migrate
   legacy Cloudinary/local assets; add MinIO backup, restore and orphan cleanup.
3. Move **all** TTS jobs, ASR jobs and Qwen imports to RabbitMQ, create Mongo-based durable
   job state/outbox, SSE updates, per-child retry/cancel, safe contentVersion checks.
4. Implement real GPU admission + cold start/unload for Worker 2, benchmark VRAM and
   throttle Qwen/Whisper contention before enabling inference concurrency >1.
5. Incrementally extract Arena, Identity, Content, Assessment and Progress into independently
   owned databases, add versioned REST/event contracts and outbox consumers. Preserve
   current Web/Admin endpoints via gateway throughout migration.
6. Add automated backup verification, dashboards/alerts, load tests and a staging rollout.

## Validation limits

Static TS syntax, Python compile, YAML parsing and ZIP integrity can be checked here.
The current workspace cannot run Docker Compose, a MongoDB/RabbitMQ/MinIO instance,
GPU inference or `pnpm install` (npm registry unavailable); **there is no verified
end-to-end build or runtime test**. Test in staging with a restored DB backup first.
