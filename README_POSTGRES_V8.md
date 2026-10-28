# VocaLearn PostgreSQL overhaul (technical worktree)

## WARNING: This is NOT an end-to-end validated production replacement

This worktree converts the Docker/PostgreSQL bootstrap, basic repository persistence,
admin seeding, queue job storage and domain-event outbox to PostgreSQL, and scaffolds
native host development. Several service-specific aggregate/populate/projection flows
still require rewriting to SQL and real integration tests. The entire stack has **not**
been proven to compile or run end-to-end. Do not delete a working V7 checkout or its backups.

## Principles

- Eight databases (`identity_db`, `content_db`, `assessment_db`, `arena_db`,
  `learning_db`, `media_db`, `ai_import_db`, `notification_db`) created by
  `database/postgres/01-init.sql`.
- Service-owned credentials; no DDL at API runtime, no migrations, no legacy dump import.
- Relational typed columns and JSONB for nested lesson/exam payloads.
- RabbitMQ domain events via PostgreSQL outbox and per-consumer inbox.
- Root `.env` controls Docker Compose and all host apps.

## Docker (experimental)

1. `Copy-Item .env.example .env`, replace **every** CHANGE secret.
2. `pnpm install --no-frozen-lockfile` (Node 24+, pnpm 11+).
3. `docker compose config --quiet`.
4. `docker compose up -d --build`.
5. `docker compose ps -a` and `docker compose logs --tail 100 identity-service postgres`.

The SQL init script executes only for an **empty** PostgreSQL volume. Resetting with
`docker compose down -v` irreversibly deletes ALL attached named volumes, including
Redis, RabbitMQ and media storage. Prefer targeted, carefully scoped volume recreation.

## Native Node + PostgreSQL mode for no discrete GPU

- Install PostgreSQL 17 locally, with running server and `psql.exe` in PATH.
- Set `PG_LOCAL_SUPERUSER`, `PG_LOCAL_PASSWORD` and all service passwords in root `.env`.
- `powershell -ExecutionPolicy Bypass -File .\scripts\init-postgres-local.ps1`
- `docker compose -f compose.infra.yml up -d --build`
- `pnpm install --no-frozen-lockfile`
- `node scripts/dev-local.mjs all` (web 3000, admin 3001, gateway 5000,
  eight backend roles 5001–5008).
- For a smaller development profile: `node scripts/dev-local.mjs identity,content,learning,web,gateway`.

The CPU configuration runs TTS/ASR without CUDA. Other heavier models (Ollama/PDF-AI)
remain optional. Running the two Compose projects at once will cause port conflicts.

## NOT YET VERIFIED OR COMPLETE

- Full typecheck (`pnpm --dir apps/api exec tsc -p tsconfig.docker.json`) was not possible
  in this build environment because npm/PNPM registry is unavailable.
- Document compatibility repository uses in-memory filtering after reading SQL rows;
  **not** suitable for production-scale datasets. Complex aggregate pipelines,
  transactions and cross-database reference projections require explicit SQL adapters.
- The old service code has read-model shortcuts across domains. They require proper
  internal HTTP calls or RabbitMQ projections; isolation tests may currently fail.
- HTTP e2e tests for Google OAuth, admin auth, TOEIC submission, XP, Arena and
  media creation must be run against a disposable PostgreSQL instance before release.
- The old static pnpm lock needs regeneration after dependencies changed.

## Never claim completion from only `docker compose config` or syntax scans

See `POSTGRES_OVERHAUL_AUDIT.json` for machine-checked results and outstanding blockers.
