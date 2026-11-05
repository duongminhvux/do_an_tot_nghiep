# Admin IAM staging (Phase 6)

This Compose project is **vocalearn-iam-phase6**, separate from vocalearn-postgres.
It binds PostgreSQL 57532, RabbitMQ 57672/57673, Mailpit 57825 and HTTPS gateway 57443 to loopback only. No production .env is loaded.

Read ADMIN_IAM_PHASE6_REPORT.md before operating. Prepare generates ignored random test secrets; existing stage.env is retained. TLS material must exist under .tmp/admin-iam-phase6/tls. Builds reuse locally installed dependency images and compile current source into separately named staging tags.

```powershell
node scripts/admin-iam-staging-prepare.mjs
# On a new local environment only, create the two-day localhost test certificate:
New-Item -ItemType Directory -Force .tmp/admin-iam-phase6/tls | Out-Null
& 'C:/Program Files/Git/usr/bin/openssl.exe' req -x509 -newkey rsa:2048 -nodes -days 2 -keyout .tmp/admin-iam-phase6/tls/server.key -out .tmp/admin-iam-phase6/tls/server.crt -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
docker compose --env-file .tmp/admin-iam-phase6/stage.env -f infra/admin-iam-staging/compose.json -p vocalearn-iam-phase6 build migrator admin-web consumer-notification
# Select staging services explicitly. Do not bring rehearsal-migrator up as a normal application.
docker compose --env-file .tmp/admin-iam-phase6/stage.env -f infra/admin-iam-staging/compose.json -p vocalearn-iam-phase6 up -d postgres rabbitmq mailpit migrator identity-service notification-service consumer-notification relay-identity content-service assessment-service learning-service arena-service media-jobs-service ai-import-service consumer-learning consumer-arena redis objectstore media-bridge admin-web gateway
node scripts/admin-iam-stage-status.mjs
```

Bootstrap helper only accepts an empty synthetic staging Identity database, verifies its marker and uses explicit test ID with actual CLI dry-run/apply. It is **not** an operator script for real accounts. After consumer verification it enables delivery flags only in ignored stage.env.

```powershell
# Run once only on fresh synthetic staging, never on restored data.
node scripts/admin-iam-staging-bootstrap.mjs
node tests/admin-iam-phase6.staging.mjs
node tests/admin-iam-phase6.browser.mjs
```

The staging integration suite intentionally interrupts RabbitMQ, Mailpit, Identity and Notification; changes test-only leases/cooldown and briefly revokes test-owner INSERT. Run without concurrent users/tests. On interruption, check staging services, Mailpit pause state and vl_notification INSERT privilege before rerunning. No volumes need deletion. Test fixtures accumulate unique names.

Backup/rehearsal scripts contain explicit live READ-ONLY backup source and isolated target checks. They require separate authorization to copy live data; **do not include them in normal startup/CI**. Rehearsal requires empty destination databases and refuses overwrite. Restored data never shares an application network; keep rehearsal-db stopped afterwards. Dumps, secrets, TLS keys, screenshots and raw logs remain ignored under .tmp, with restricted local backup ACL; do not publish them.

Mail delivery is real SMTP to Mailpit only, with MAIL_SANDBOX_ONLY=true and .test recipients. No external mailbox or Gmail credentials are used. A self-signed localhost certificate is for local test only. Neither Compose file nor helper is a production deployment recipe.
