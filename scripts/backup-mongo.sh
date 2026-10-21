#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
DB="${MONGO_DB_NAME:-english-platform}"
if [[ "$DB" == *[!a-zA-Z0-9_-]* || -z "$DB" ]]; then echo 'Invalid MONGO_DB_NAME' >&2; exit 2; fi
DEST="${BACKUP_DIR:-./backups/mongodb}"
mkdir -p "$DEST"
chmod 700 "$DEST" 2>/dev/null || true
OUT="$DEST/${DB}_$(date -u +%Y%m%dT%H%M%SZ).archive.gz"
TMP="${OUT}.partial"
trap 'rm -f "$TMP"' EXIT
# Does not stop containers or wipe volumes. Run on the source server before deploying.
echo "Backing up MongoDB '$DB' to $OUT"
docker compose exec -T mongo mongodump --db "$DB" --archive --gzip > "$TMP"
test -s "$TMP" || { echo 'Empty backup; not saved' >&2; exit 1; }
mv "$TMP" "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
trap - EXIT
echo "Done: $OUT"
