# Fix MongoDB container detection for Windows PowerShell 5.1 / Docker Compose 5.x

Files changed:
- `scripts/import-legacy-dump.ps1`
- `scripts/backup-service-dbs.ps1`

1. Back up both existing scripts if you customized them.
2. Extract this ZIP to the V5 project root, overwriting the two `scripts/*.ps1` files.
3. Make a backup of all NEW microservice databases before applying an import:

   powershell -ExecutionPolicy Bypass -File .\scripts\backup-service-dbs.ps1

4. Preview legacy dump (stages data only to `legacy_import`; no business DB writes):

   powershell -ExecutionPolicy Bypass -File .\scripts\import-legacy-dump.ps1 -Dump "D:\english-platform.dump"

5. Once the plan is valid and backup is secured, run:

   powershell -ExecutionPolicy Bypass -File .\scripts\import-legacy-dump.ps1 -Dump "D:\english-platform.dump" -Apply

Do NOT run `docker compose down -v` or `mongorestore --drop`.
`db-init` being Exited (0) is expected.

This patch only repairs detection of the MongoDB container. It has NOT been
validated against live MongoDB/Docker in this environment. The importer may
still report data conflicts in seeded collections (especially admins); in
that case do not resume writes until resolving the conflicts safely.
