# Docker operation — optimized shared builds

After configuring your **existing local `.env`**, deploy the standard stack:

```powershell
docker compose up -d --build
```

- `db-init` verifies rs0 and reconciles all service-owned MongoDB databases
  against `database/schema/collections.json` (see `database/README.md`).
  Schema changes are part of its Docker build inputs and cause re-creation.
- Nine independent NestJS processes (eight API roles + audio worker) use one
  compiled API image. They remain separate containers with separate startup
  commands, permissions and database connections.
- Projection, domain-event, ASR-job and (optional) PDF-AI worker containers each
  share their group's runtime image instead of recompiling/re-exporting it.
- Compose has **45 services but only 13 image build definitions** (including
  the optional PDF-AI image), instead of 38. `build.provenance: false` and
  `sbom: false` are used for local builds; requires Docker Compose v2.39+.
- No old database import is performed automatically. Manual import:
  `scripts/import-legacy-dump.ps1`.

To protect a 32 GB / NVMe development machine during first build, put
`COMPOSE_PARALLEL_LIMIT=2` in your local `.env` or use:

```powershell
docker compose --parallel 2 up -d --build
```

A first build may still take time to download Python, PyTorch, Whisper/Kokoro
and Node/Next dependencies. The shared API is compiled in **one TypeScript
program**, not nine parallel `tsc` processes. Unchanged images/layers are cached.

## Check startup

```powershell
docker compose config --quiet
docker compose ps -a
docker compose logs --tail=100 db-init
docker compose logs --tail=100 identity-service content-service assessment-service
docker compose logs --tail=100 projection-relay-content
```

To force schema reconciliation when only live database objects (rather than
`collections.json`) have changed:

```powershell
docker compose up -d --force-recreate db-init
docker compose up -d --build
```

**Never** remove `mongo_data`, other named volumes or use `down -v` to fix
schema mismatches. Take a verified MongoDB backup before applying migrations.
See [`DEPLOY_FRESH.md`](DEPLOY_FRESH.md) for first-run checks.

## Admin account bootstrap

When `ADMIN_SEED_ENABLED=true`, the `admin-seed` one-shot service runs after
`db-init` and before `identity-service`. It uses the existing shared API image
and creates an Admin only if missing. It does NOT change an existing password.
See [SEED_ADMIN_VI.md](SEED_ADMIN_VI.md) for local admin/admin setup and reset commands.
