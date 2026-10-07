# Merge fixes

This project merge had unresolved Git conflict markers in the admin sidebar and Vietnamese locale JSON. They were resolved by keeping both features:

- Dictation remains a top-level admin menu item.
- Assessment remains the newer collapsible menu with Exam Groups and Exams.
- Vietnamese navigation contains both Dictation and Assessment entries.

The admin login 401 issue also had an inconsistent seed configuration:

- `AdminsService` previously defaulted to `Password123@`.
- `seed-admin.mjs` previously defaulted to `admin123`.
- `seed-admin.mjs` used to read an app-level `apps/api/.env`, which could conflict with Docker runtime values. Environment loading is now centralized at root `.env`, and runtime-injected variables keep precedence.

Both seed paths now use `admin123` by default. The manual seed/import/migration scripts load only the root `.env`, and an already-provided runtime variable keeps precedence.

For an existing Docker Mongo volume, reset the old hash once after the stack starts:

```bash
docker compose exec api pnpm --filter api seed:admin admin@gmail.com admin admin123
```
