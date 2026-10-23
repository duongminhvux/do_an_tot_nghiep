# VocaLearn — Clean Microservices (fresh database build)

**Default first run:** copy `.env.example` to `.env`, configure secrets, then run
`docker compose up -d --build`. For first install it creates the eight-database
MongoDB layout from `database/schema/collections.json`; on later deployments it
additively reconciles missing collections, indexes and warning validators without
removing existing data, then starts each service.
**No database backup, old cutover marker or migration from the monolith is involved.**

- `apps/web`, `apps/admin-web`: Next.js applications
- `infra/gateway`: Nginx Gateway maintaining `/api/*`
- Eight NestJS services: Identity, Content, Assessment, Arena, Learning,
  Media Jobs, AI Import, Notification
- RabbitMQ: events/background commands; Redis: Arena/presence/cache
- MongoDB: one replica-set host, separate owned databases, explicit read projections
- SeaweedFS object store with the S3 protocol; separate Python worker processes

Architecture checks: `python scripts/check-fresh-stack.py`,
`python scripts/check-microservice-routes.py`, `docker compose config --quiet`.

See [DEPLOY_FRESH.md](DEPLOY_FRESH.md) and [database/README.md](database/README.md).

For a **separate, manual old-dump import** see [IMPORT_LEGACY_DUMP.md](IMPORT_LEGACY_DUMP.md).
Import never runs automatically during `up --build`.

GPU orchestrator/autoscaling is intentionally **outside the scope** of this edition.
The advanced `ai` Compose profile is optional.

**Verification limitation:** static validation is not a substitute for a real
Docker build and integration tests with MongoDB/RabbitMQ/object storage.
