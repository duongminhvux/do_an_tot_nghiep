# PostgreSQL-only bootstrap

`database/postgres/01-init.sql` is the source of truth for **fresh installations**.
It creates eight service-owned databases, their business tables, and outbox/inbox tables.
The Docker image executes `01-init.sh` automatically when the PostgreSQL data volume is EMPTY.
Editing the bootstrap does not update an existing volume. Missing Assessment PDF correction
tables and erroneous Content/Arena nested-field requirements can be repaired with
`scripts/repair-postgres-docker.ps1` without deleting rows; other schema changes
require a reviewed SQL repair or deliberate database recreation with backup.

For native local PostgreSQL, run `scripts/init-postgres-local.ps1` after configuring root `.env`.
Never run destructive `docker compose down -v` on a database that contains data you need.
