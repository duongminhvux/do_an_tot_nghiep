# Microservices migration — Phase 1–8 (transition build)

> **Important:** This is a staged **process-level split**, not a fully independent-database microservices implementation. The original MongoDB (`english-platform`) is deliberately retained to prevent destructive changes. Production cutover requires smoke tests and a dependency-by-dependency data-ownership migration.
>
> The original single-API `docker compose up --build` remains the rollback path. New services start only with optional Compose overlays/script.

## Completed scope, explicit limitations

| Phase | What this build adds | Still needs work before calling it complete |
|---|---|---|
| 1 Gateway/contracts | Nginx Gateway on port 5000 with route mappings for Auth, Content, Assessment, Arena, Learning, Media, AI and Notifications; fallback API on 127.0.0.1:5009; static route-check script | Per-service OpenAPI/event DTO contract versioning and automated API integration tests |
| 2 Media/AI | Independent Nest Media-Jobs role, RabbitMQ audio job runner, async ASR Job API/runner, Qwen worker + job state volume | Convert all synchronous TTS/ASR endpoints to async gradually; Qwen per-job transactional state/outbox |
| 3 Identity | Identity role handles User/Admin, introspection endpoint authenticated with private token; other Nest services use a thin JWT client | Remove non-auth models from Identity's UserService, finalize independent DB ownership |
| 4 Content | Content role owns Vocab/Dictation controllers | Learning currently imports VocabularyModule and reads its collections directly |
| 5 Assessment | Assessment role owns Exam/Question/Attempt; Qwen PDF import Nest controllers moved to AI role | Media Jobs still reads Question/Passage models for generation; migrate to contracts/events |
| 6 Arena | Arena process owns Socket.IO, match-clock and route; legacy clock disabled | Arena still reads User/Word MongoDB collections directly |
| 7 Learning/Notification | Learning, Minigame, ActivityLogs and Gmail run under separate roles; Mongo Outbox/RabbitMQ event relay + idempotent receipt consumers | Consumers record event receipts only; actual read-model projections and transaction-safe outbox needed |
| 8 Deployment | Single-server multi-service Compose overlays; GPU Server B example, health/status UI, DB and S3 backups, route tests | GPU-node template needs private VPN, broker/DB ACL and coordinated cutover, NOT plug-and-play production deployment |

## Prerequisites and secrets

- Keep your existing `.env` file **outside Git**; never replace the working environment with `.env.example`.
- For split deployment add random secrets at least 24 characters: `IDENTITY_INTERNAL_TOKEN`, `JOB_INTERNAL_TOKEN`, `MEDIA_INTERNAL_TOKEN`.
- Configure `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_URL` (the URL must point to RabbitMQ's Docker service by the correct internal host, e.g. `rabbitmq:5672`); `S3_ACCESS_KEY`, `S3_SECRET_KEY`; `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
- Keep `DOCKER_MONGO_URI` pointing at the **same existing MongoDB** during the process-only split. **Do not drop collections.**
- A Docker engine, Docker Compose plugin, and adequate CPU/disk/VRAM are required. GPU mode requires NVIDIA container runtime.

## 0 — BACK UP BEFORE MIGRATING

PowerShell in project root:

```powershell
.\scripts\backup-before-split.ps1 -DbName "english-platform"
```

This runs MongoDB backup (`mongodump`) and object backup from S3/MinIO using `python` + `boto3`. Install boto3 on the workstation (`python -m pip install boto3`) if absent. The S3 script reads credentials from `.env`; for Docker's internal `S3_ENDPOINT=http://minio:9000` it connects to the host's published `http://127.0.0.1:9000` by default. Set `S3_BACKUP_ENDPOINT` if using a different host/port. Backups are timestamped under `backups/mongodb` and `backups/media`. Always verify an actual restore **into a separate testing database/bucket** before trusting backups. Uploaded PDF and generated files still in `./storage` outside MinIO must also be backed up as regular files.

Individual commands:

```powershell
.\scripts\backup-mongo.ps1 -DbName "english-platform"
python scripts/s3-backup-restore.py backup --env-file .env --out backups/media
```

S3 restore deliberately skips existing objects, never deletes them:

```powershell
python scripts/s3-backup-restore.py restore --env-file .env --from backups/media/20261021T000000Z --yes-i-have-verified-target
```

This does **not** replace MongoDB backup/restore; text is still in MongoDB.

## 1 — Verify migrations and route mappings

```powershell
python scripts/check-microservice-routes.py
docker compose build api
docker compose run --rm db-migrate node apps/api/src/scripts/db-migrate.mjs --dry-run
```

Inspect pending migrations; only then run them through the one-off `db-migrate` job. Do not run a migrator inside each API instance. The new migrations `0005` and `0006` create event/job indexes and preserve existing collections.

## 2 — Start split mode on ONE server

```powershell
.\scripts\up-microservices.ps1
```

For GPU overlays and Qwen worker on the same server:

```powershell
.\scripts\up-microservices.ps1 -Gpu
```

The launch script uses a Compose overlay: API Legacy binds `127.0.0.1:5009`, and public Gateway listens on `:5000`. All Next.js API URLs can continue targeting `http://localhost:5000/api`. Internal role services are on the Compose network only. `legacy` retains the old AppModule for unknown routes; when split mode is enabled the legacy Arena match clock is disabled.

**Important:** The `-Gpu` set is only appropriate when all supporting services and secrets are configured. If this is the first attempt, start without GPU option and validate the Gateway and business APIs first. Model-init and GPU admission are configurable and need real hardware tests.

## 3 — Basic smoke checks

```powershell
Invoke-RestMethod http://localhost:5000/gateway/health
Invoke-RestMethod http://localhost:5000/api/health
# Login tests should be performed with your EXISTING admin/user accounts.
docker compose -f docker-compose.yml -f infra/compose/storage.yml -f infra/compose/rabbitmq.yml -f infra/compose/microservices.yml ps
```

Required smoke sequence: Admin login/refresh; user login; browse Vocabulary/Dictation; TOEIC list and submit an attempt; Arena WebSocket join/reconnect; background TTS single/bulk; ASR upload/job poll; Qwen PDF import/review; media image/audio playback; inspect retry/DLQ. Re-run with all overlays enabled. Existing users and progress must remain unchanged.

## 4 — Messaging and security model

- **Synchronous:** Gateway/REST for login, questions, words and attempt submissions.
- **Asynchronous jobs:** RabbitMQ for TTS/ASR/Qwen. Worker ACK only after output is safely recorded. Retry/DLQ and idempotence still need stress tests.
- **Domain events:** MongoDB `domain_outbox` -> RabbitMQ topic -> consumers store idempotent receipts (`processed_domain_events`). This is **not yet a transactional outbox**: transactions need MongoDB replica set + session integration.
- **Realtime:** Arena uses Redis/Socket.IO; job progress uses REST with optional SSE.
- **File assets:** MinIO S3 adapter; old `./storage` remains as compatibility fallback.
- **Secrets:** Never expose `/api/_internal/*`, MongoDB, Redis, RabbitMQ or Ollama on the public Internet; use least privilege, authentication and a private network.

## 5 — Split across two servers (future)

- **Server A:** Web/Admin, Gateway, business services, MongoDB, Redis, RabbitMQ, MinIO, event relay.
- **Server B:** TTS, Whisper, Ollama/Qwen, Qwen worker, audio worker, ASR worker. Use `docker-compose.gpu-node.example.yml` as a **template**, not a ready-to-run production configuration.
- Configure private WireGuard/Tailscale/VPN, MongoDB authentication and RabbitMQ/Redis ACLs. Expose required endpoints only on the private interface (Server A's default MinIO binding is localhost-only, so remote S3 access needs a carefully secured network configuration).
- Point business services' `TTS_SERVICE_URL`, `ASR_SERVICE_URL`, `PDF_AI_URL` to Server B private addresses. Do not keep the same local GPU job runners consuming on Server A; disable them during cutover.
- The Qwen API **and** Qwen worker share `./storage/pdf-ai` on Server B; do not move only one of them. For stateless multi-node AI import later, replace that shared path with MinIO object keys and durable MongoDB job records.
- GPU-node templates need an operator to configure actual endpoint/IPs, secrets and firewall rules and validate end-to-end. Don't assume Docker named volumes span multiple hosts.

## 6 — Rollback (no volume deletion)

```powershell
.\scripts\down-microservices.ps1
# Or -Gpu if you started with -Gpu
# Original single-API mode:
docker compose up -d --build
```

The down script deliberately does **not** pass `-v`. Before rollback, stop jobs/writes and verify pending migrations remain compatible with the previous image. Restoring Mongo/media is a separate **explicit manual action**, never automatic.

## 7 — Known architectural debt / outstanding production gates

1. Services continue to use **the same MongoDB database** during transition. Next migration must remove cross-service Mongoose imports and establish individual DB ownership before backfill/splitting databases.
2. Event relay's receipt consumers don't yet materialize business progress/notification projections. Cross-service business state still has shared collections.
3. Redis/GPU lease controls are advisory resource admission; hardware VRAM/CPU benchmarks, stale-lease recovery and failure tests remain necessary.
4. Elastic TTS worker is **configured and admission-gated**, not dynamically launched by Docker on Admin command; horizontal process autoscaling needs an orchestrator or a privileged deployment controller.
5. Full `pnpm build`, Docker Compose up, Mongo migration against real data, YouTube/TOEIC integration, and GPU inference are **not verified in the authoring environment**. Validate on a copy of production DB before cutover.
6. Legacy `/api/*` fallback is intentional for phased rollout and may still load old Nest modules. Only remove it after route parity + data ownership are verified.

**Do not switch a live production server directly without backups, smoke tests, and a rollback window.**
