# VocaLearn V9 hardening patch (2026-10-24)

Source: `project(20261024-060024).zip` as supplied by user. This is an **experimental corrective patch**, not a certified production release. All changes use the existing PostgreSQL microservice boundaries and existing S3-compatible SeaweedFS media bridge.

## Implemented

- PDF-AI: publish generated PDF images from worker scratch to S3 (`pdf-ai/{jobId}/...`) before reporting success. Wire the `pdf-ai` and `pdf-ai-worker` services to the authenticated `media-bridge`; use same-origin `/media/pdf-ai` URLs. Worker restart state handling rejects stale local jobs; RabbitMQ-backed live jobs can be polled after API restart.
- Audio processing: claim PostgreSQL `audio_jobs` with one atomic SQL `UPDATE ... RETURNING`, lease owner/generation, guarded heartbeat/complete and retry state. A lost lease cannot overwrite database completion from a newer lease.
- Transactional outbox: introduce `DomainOutboxService.withTransaction()` and use it for several critical business state/event pairs (create/update user, create exam, grading a TOEIC attempt, dictation completion, Arena match finalization). Unconverted operations remain a known gap.
- Learning credit: add event-driven Learning consumer applying XP to `learning_activities` and `learning_credit_ledger` within the same transaction and unique source key. Learning-owned credits also write activity+ledger atomically via SQL. Add minimal versioned identity display projection.
- Domain event consumers: receipt, business handling and inbox marker share one SQL transaction; ACK only after commit. Include retry and dead-letter queues, and a content outbox relay. Other domain projections are not yet implemented.
- Migration gate: Docker `schema-migrate` applies existing versioned/checksum migrations before starting application services; local `scripts/dev-local.mjs` also runs migration checks. Strict drift detection may reject previously hand-modified schemas; review/backup rather than deleting volumes.
- Readiness: `/api/health/live` and `/api/health/ready` in NestJS; database connectivity, Redis for Arena and object store for Media Jobs. Other dependency checks are still incomplete.
- Basic SQL server-side WHERE/COUNT/EXISTS pushdown in `compat.ts` for supported predicates; complex adapters remain unbounded and need separate owner repositories.
- Media: basic magic-byte validation for uploads and deny public `/media/asr-jobs/*` and `/media/private/*` downloads. This is not full per-object authorization.
- Safe Admin: default automatic admin bootstrap off unless explicitly enabled.

## Review finding status

| Production review finding | Status | Remaining work |
| --- | --- | --- |
| Unbounded PostgreSQL adapter and internal full-table HTTP APIs | PARTIAL | Complete SQL pagination/aggregation; replace broad `read-models` endpoint/token by narrowly authorized owner APIs. |
| State changes and outbox event atomicity | PARTIAL | Audit and convert every writer, concurrency/crash tests with real PostgreSQL. |
| Domain-event consumer business projections | PARTIAL | Identity display and Learning XP handled; other domain event projections, reconciliation/backfill not complete. |
| Lossless XP on outages | PARTIAL | TOEIC, Dictation, Arena event credit and Learning-owned credit implemented; end-to-end recovery and reconciliation still unverified. |
| Atomic audio worker leases | IMPLEMENTED / UNVERIFIED | Concurrent PostgreSQL workers, delayed retries, side-effect idempotency and expired-lease crash tests needed. |
| Schema migrations and release gate | IMPLEMENTED / UNVERIFIED | Run migrations against current DB backup/staging and verify fresh/existing DB; preserve data. |
| Dependency-aware health/readiness and operational recovery | PARTIAL | RabbitMQ etc., metrics, alerts, validated restore and availability targets not done. |
| Service secrets, least privilege, seed-admin, CI | PARTIAL | Shared `INTERNAL_SERVICE_TOKEN`, broad internal read API, dependency/image pin audit, security CI unresolved. |
| Media S3, including generated PDF imagery | IMPLEMENTED / UNVERIFIED | Requires live upload/GET/Range checks through Gateway and object store; scratch/source files still local. |

## Validation performed in this environment

- Python: `python -m pytest -q services/pdf-ai/test_*.py services/domain-events/test_handlers.py` -> **81 passed, 11 subtests passed**.
- TypeScript/TSX: 685 files parsed with global TypeScript compiler API -> **0 syntax errors**. Not a full project typecheck.
- `python -m compileall -q services` -> passed.
- YAML: docker-compose.yml, compose.infra.yml, compose.edge.yml parse correctly. `compose.edge.yml` is an overlay and intentionally references services in the base compose.
- No Docker daemon, PostgreSQL server, RabbitMQ, Redis or project `node_modules` available for full typecheck, image build or runtime E2E. Do not equate static checks with production readiness.

## Upgrade without losing data

1. Back up the existing PostgreSQL databases and SeaweedFS bucket. Keep a copy of the current working repository.
2. Apply this patch over the repo root. The patch deliberately excludes `.env` and its live credentials. Verify root `.env` settings and review changes.
3. Check schema migration behavior on a cloned database first. Checksums/fingerprints intentionally fail closed if schema drift is detected.
4. Run `docker compose config --quiet` and `docker compose up -d --build` in your own Docker environment.
5. If PDF-AI is required: `docker compose --profile ai up -d --build` (may start large local AI services; plan RAM and CPU accordingly).
6. Verify logs, `/api/health/ready`, user/admin login, TOEIC attempts, Arena, RabbitMQ outbox/inbox, XP ledger, S3 upload/GET/Range, PDF-AI image links and the CPU-only Hybrid mode.
7. Never use `docker compose down -v` on a deployment containing valuable data.

## Security warning

Original uploaded ZIP contained a populated `.env` with credentials/secrets. The full and incremental distribution ZIP files **exclude** `.env`, local storage, caches, and backups. Do not publish your original ZIP. Rotate any credentials exposed to unauthorized recipients.
