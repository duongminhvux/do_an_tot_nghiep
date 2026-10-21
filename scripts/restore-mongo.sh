#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
BACKUP="${1:-}"
[[ -f "$BACKUP" ]] || { echo "Usage: bash scripts/restore-mongo.sh backups/mongodb/<file>.archive.gz" >&2; exit 2; }
DB="${MONGO_DB_NAME:-english-platform}"
if [[ "$DB" == *[!a-zA-Z0-9_-]* || -z "$DB" ]]; then echo 'Invalid MONGO_DB_NAME' >&2; exit 2; fi
if [[ -f "$BACKUP.sha256" ]]; then sha256sum -c "$BACKUP.sha256" || exit 1; fi
read -r -p "Restore into DB '$DB' (without --drop)? Type RESTORE to continue: " CONFIRM
[[ "$CONFIRM" == 'RESTORE' ]] || exit 2
# Do not --drop automatically; users must explicitly plan an overwrite/rollback.
docker compose exec -T mongo mongorestore --db "$DB" --archive --gzip < "$BACKUP"
echo 'Restore completed. Check logs and collection counts.'
