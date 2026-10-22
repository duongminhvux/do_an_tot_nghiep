# VocaLearn — Microservices monorepo

Run `docker compose up -d --build` after configuring `.env`. Existing MongoDB
volumes are preserved; `db-init` checks and additively merges the schema.

- [Architecture and ownership](CLEAN_MICROSERVICES_README.md)
- [Fresh deployment](DEPLOY_FRESH.md)
- [Fresh database schema](database/README.md)
- [Optional old `.dump` import](IMPORT_LEGACY_DUMP.md)

Check layout with `python scripts/check-fresh-stack.py`.
