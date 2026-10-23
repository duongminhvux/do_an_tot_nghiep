# Verification and limitations

Tested in the source-editing environment:

- YAML parsing and reference checks of 45 Compose services; 38 previous
  build definitions reduced to 13 (including schema migration image).
- 8 database namespaces, 47 owned collections, and 121 collections including
  read projections and internal system collections.
- In-memory MongoDB shell simulation (121 collections): initial boot, repeat,
  missing collection repair, additive manifest merge, preservation of old user
  documents and immutable projection checkpoints, and safe unique-index conflict
  handling.
- 34 representative Nginx routes / Socket.IO paths (static routing smoke).
- 646 TypeScript/TSX source files parsed without syntax errors; local relative
  API imports resolved.
- Python sources compiled syntactically; JS importer syntax check passed.
- ZIP archive checked for CRC errors.

Not tested: **real** `docker compose up --build`, real MongoDB replica set
bootstrap, real `mongorestore` on the user's `.dump`, full Nest/Next TypeScript
builds, RabbitMQ integration, S3 health in Docker Desktop, full E2E Web/Admin,
Python package download on the user's network, or CPU inference performance.
These still require on-machine integration validation before production.

The previous Web/Admin log contained *canceled* build jobs following Debian APT
connection timeouts. That log did **not** establish a reproducible Next.js
compiler error. HTTPS APT retries and a shared pnpm dependency layer address
what was evidenced, but cannot guarantee success during an upstream outage.

The old 23 MB unused root `combined_vocab.json` has been removed from this clean
source archive because no code imports it. User-generated data in local `storage/`
remains included; legacy media must be backed up and migrated separately from MongoDB.

This patch was verified **without a Docker daemon**. The full container image
builds and live MongoDB reconciliation must still be exercised on the deployment
host. Docker Compose must be at least v2.39 for `provenance` and `sbom` flags.
