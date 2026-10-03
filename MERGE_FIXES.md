# Merge fixes

This project merge had unresolved Git conflict markers in the admin sidebar and Vietnamese locale JSON. They were resolved by keeping both features:

- Dictation remains a top-level admin menu item.
- Assessment remains the newer collapsible menu with Exam Groups and Exams.
- Vietnamese navigation contains both Dictation and Assessment entries.

The admin login 401 issue also had an inconsistent seed configuration:

- `AdminsService` previously defaulted to `Password123@`.
- `seed-admin.mjs` previously defaulted to `admin123`.
- `seed-admin.mjs` also overwrote runtime Docker environment values with `apps/api/.env`, which could make it connect to the wrong MongoDB host when executed inside Docker.

Both seed paths now use `admin123` by default, and the manual seed script only reads `.env` values when that variable was not already provided by the runtime environment.

For an existing Docker Mongo volume, reset the old hash once after the stack starts:

```bash
docker compose exec api pnpm --filter api seed:admin admin@gmail.com admin admin123
```
