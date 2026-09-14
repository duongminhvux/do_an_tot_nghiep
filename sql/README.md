# SQL database source

`database.sql` is the PostgreSQL 16 schema source of truth for a **fresh** database.

`seed.sql` is development-only seed data and is executed immediately after
`database.sql` when PostgreSQL initializes an empty data directory.

Docker mounts them as:

```text
/docker-entrypoint-initdb.d/01-database.sql
/docker-entrypoint-initdb.d/02-seed.sql
```

PostgreSQL only executes `/docker-entrypoint-initdb.d/*` when its data directory is
empty. Therefore this project also has two small runtime scripts:

- `compat.sql` — idempotent compatibility DDL for development volumes created by
  older ListenUp builds. It does **not** replace `database.sql`; it only adds the
  historical columns/indexes/foreign keys that the current API requires.
- `verify.sql` — fail-fast verification of the critical schema contract. If the
  database is too old or structurally incompatible, Compose stops before the API
  starts instead of allowing a later Prisma 500 error.

The Compose service `db-prepare` runs `compat.sql` and then `verify.sql` on every
startup. On a fresh database the compatibility script is effectively a no-op because
`database.sql` already contains the current structure.

## Normal development startup

```bash
docker compose up --build
```

This is safe with an existing development volume. For example, an older volume that
is missing `tts_jobs.group_id` is upgraded automatically before the API starts.

## Intentional full rebuild

Only when you explicitly want to discard development data:

```bash
docker compose down -v
docker compose up --build
```

Do not use Prisma migrations or `prisma db push`. Prisma in this project is an
ORM/client mapping only. `apps/api/prisma/schema.prisma` mirrors `database.sql` for
Prisma Client generation and type-safe queries.
