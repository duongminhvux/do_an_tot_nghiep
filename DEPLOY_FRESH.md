# Fresh deployment — one Docker command, no legacy data

This repository is configured so the **only deployment command** for the standard
CPU stack is:

```powershell
docker compose up -d --build
```

**Prerequisite:** Docker Desktop/Compose and a root `.env` copied from `.env.example`
with real unique secrets. `.env` is local and excluded from the ZIP.
Docker Compose **v2.39+** is required (local builds disable provenance/SBOM).
Docker must be able to access Docker Hub, Debian package mirrors and PyPI for a first
build; builds cannot succeed offline without mirrored dependencies.

For machines with 32 GB RAM, set `COMPOSE_PARALLEL_LIMIT=2` in `.env` to avoid
parallel disk contention while retaining the exact deployment command.

This command automatically:

- Starts MongoDB 8 as single-node replica set `rs0`.
- Runs `db-init`, which creates eight service DBs and 121 owned/projection/internal
  collections and indexes from `database/schema/collections.json`. On subsequent
  manifest updates, it performs additive reconciliation without deleting existing
  data. **No imported data**.
- Starts Redis, RabbitMQ, S3-compatible SeaweedFS, eight backend NestJS services,
  message-projection jobs, media/audio queues, API Gateway, Web and Admin Web.
- Runs inference services for CPU by default; the optional `ai` profile for
  Ollama/Qwen/PDF AI is separate because model downloads/resources are significant.
- Uses project-specific named volumes so DB and object storage survive restarts.

The initial database is empty: by default there is intentionally **no preset Admin password**.
For an explicit local-development seed with login `admin` / password `admin`:

```powershell
docker compose run --rm --no-deps -e DEFAULT_ADMIN_PASSWORD=admin -e ADMIN_SEED_ALLOW_WEAK_PASSWORD=true admin-seed node apps/api/src/scripts/seed-admin.mjs
```

For automatic one-time creation after `db-init`, set `ADMIN_SEED_ENABLED=true`,
`DEFAULT_ADMIN_PASSWORD` and (only if deliberately using a weak local password)
`ADMIN_SEED_ALLOW_WEAK_PASSWORD=true` in `.env` before `docker compose up -d --build`.
Existing passwords are not silently reset. See [SEED_ADMIN_VI.md](SEED_ADMIN_VI.md).

**How to check**:

```powershell
docker compose config --quiet
docker compose ps
docker compose logs db-init --tail=100
docker compose logs gateway web admin-web --tail=100
```

To verify database collections (does not import anything):

```powershell
$mongo = (docker compose ps -q mongo).Trim()
docker exec $mongo mongosh --quiet --eval 'db.getSiblingDB("identity_db").getCollectionNames()'
```

## Manual Docker cleanup

If you choose to erase your development stack **after verifying backups**, do so
manually:

```powershell
docker compose down --remove-orphans --volumes
# Then inspect images for this project with docker images, and remove only
# selected images using docker image rm <image-id>.
```

`down --volumes` is destructive. It deletes the MongoDB, Redis, RabbitMQ and object
storage data in Compose-managed named volumes. It does **not** delete files mounted
from your host (e.g. `./storage`). Do **not** use `docker system prune --volumes` as a
substitute: that can affect unrelated projects.

For an existing `.dump`, **build first and import separately**:
[`IMPORT_LEGACY_DUMP.md`](IMPORT_LEGACY_DUMP.md).

## If Docker build fails due external dependencies

The earlier log showed `deb.debian.org:80` timing out when installing `ffmpeg`,
`espeak-ng`, and `libsndfile1`. Debian APT Dockerfiles now use HTTPS and retries.
Python pip also uses a retryable cached installation. The Web/Admin build steps in
that log were marked **CANCELED**, not independently diagnosed with Next.js errors.
When a transient network build failure interrupts all targets, rerun the same
`docker compose up -d --build` command. Docker will reuse successfully cached layers.
If failures persist, fix Docker Desktop's proxy/DNS/registry access; code changes
cannot guarantee external repositories remain reachable.
