# Environment variables

Copy `.env.example` to `.env` and set real credentials/secrets. Compose reads this
root file. The new services use individually named MongoDB databases in a
single `rs0` instance; no `LEGACY_MONGO_URI` is required to start them.

The optional legacy importer connects only to a **staging** database named
`legacy_import`, under explicit `-Dump` and `-Apply` user control.

`COMPOSE_PARALLEL_LIMIT=2` and `COMPOSE_BAKE=false` are set in `.env.example` to
reduce BuildKit fan-out on a machine with slow registry/mirror access.

See [`DEPLOY_FRESH.md`](DEPLOY_FRESH.md) for configuration and runtime checks.
