# Service-owned database and communication contracts

Schema source of truth: [`schema/collections.json`](schema/collections.json).
Historical data mapping (used manually only): [`import/ownership.json`](import/ownership.json).

- **Sync**: REST through Nginx API Gateway (Web/Admin); internal service calls are token-protected.
- **Async**: durable RabbitMQ message routing for TTS, ASR and domain events.
- **Service data**: each NestJS service reads and writes ONLY its named MongoDB database.
- **Read-model projections**: owner MongoDB change streams → RabbitMQ → target-owned projection collection, with resume checkpoints and monotonic revision logic.
- **Arena**: Redis socket/presence/matchmaking state, MongoDB ratings and history.
- **Media**: S3-compatible object storage, served via internal media bridge.
- **Identity**: only Identity stores passwords and account records; other services validate via internal endpoint.

`db-init` creates or reconciles collections, warning validators and indexes.
It preserves immutable `initial_schema_v1` markers/change-stream checkpoints and
stores the latest checksum in `schema_manifest_current`. It never imports legacy
user data, deletes collections, or changes existing documents.

Incompatible schema/data changes (renames, backfills, unique index conflicts)
still require an explicit service-owned, reviewed migration. Production should add per-service MongoDB
users and rotate secrets; the local Compose instance isolates Mongo on a network.
