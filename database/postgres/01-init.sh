#!/usr/bin/env bash
# PostgreSQL official image executes this only when PGDATA is empty.
# All 8 databases and service-owned tables are generated from 01-init.sql.
set -euo pipefail
for name in POSTGRES_USER PG_IDENTITY_PASSWORD PG_CONTENT_PASSWORD PG_ASSESSMENT_PASSWORD \
    PG_ARENA_PASSWORD PG_LEARNING_PASSWORD PG_MEDIA_PASSWORD \
    PG_AI_IMPORT_PASSWORD PG_NOTIFICATION_PASSWORD; do
  if [[ -z "${!name:-}" ]]; then
    echo "[postgres-init] Missing environment variable: ${name}" >&2
    exit 1
  fi
done

psql -X -v ON_ERROR_STOP=1 \
  -U "$POSTGRES_USER" -d postgres \
  -v identity_password="$PG_IDENTITY_PASSWORD" \
  -v content_password="$PG_CONTENT_PASSWORD" \
  -v assessment_password="$PG_ASSESSMENT_PASSWORD" \
  -v arena_password="$PG_ARENA_PASSWORD" \
  -v learning_password="$PG_LEARNING_PASSWORD" \
  -v media_password="$PG_MEDIA_PASSWORD" \
  -v ai_import_password="$PG_AI_IMPORT_PASSWORD" \
  -v notification_password="$PG_NOTIFICATION_PASSWORD" \
  -f /opt/vocalearn-bootstrap/01-init.sql

echo "[postgres-init] Created eight isolated service databases."
