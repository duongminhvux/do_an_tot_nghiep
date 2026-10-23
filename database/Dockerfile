# schema is COPYed instead of bind-mounted so `docker compose up --build`
# detects a manifest change, recreates db-init, and reconciles MongoDB first.
FROM mongo:8.0
COPY database/init.js /bootstrap/init.js
COPY database/schema/collections.json /bootstrap/schema/collections.json
