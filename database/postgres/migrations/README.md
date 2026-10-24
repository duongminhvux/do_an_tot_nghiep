Migration adoption checks (2026-10-24): 14 PostgreSQL integration checks and focused
TypeScript compilation passed. A divergent first-time legacy adoption rolls back
the entire owner upgrade; status does not write history. Existing rows are retained.

`contracts.json` records the canonical fresh schema and the checksum of the ordered
migration set. For a reviewed new migration, generate a new reference against EMPTY
disposable owner databases with `node scripts/generate-schema-contracts.mjs --write`.
The generator rejects existing tables and rolls back its reference DDL. Never copy
a production fingerprint into this manifest to accept drift.

Manual entry points: `node scripts/migrate.mjs --all --status` and
`node scripts/migrate.mjs --all`. Configure root `.env` owner credentials first.
These standalone tools do not enable deployment hooks. Backup/restore verification
and deployment integration remain outstanding; take a verified backup before applying
migrations to a live installation.
