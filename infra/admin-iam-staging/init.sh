#!/bin/sh
set -eu
for name in identity content assessment arena learning media ai_import notification; do
  upper=$(printf '%s' "$name" | tr '[:lower:]' '[:upper:]')
  eval "password=\$PG_${upper}_PASSWORD"
  psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -v owner="vl_$name" -v db="${name}_db" -v password="$password" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'owner', :'password') WHERE NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=:'owner') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'owner') WHERE NOT EXISTS(SELECT 1 FROM pg_database WHERE datname=:'db') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'db') \gexec
SQL
done
