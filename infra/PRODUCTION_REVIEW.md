# Production review — 2026-10-24

Scope: current source and the local Docker deployment. This is not a penetration test,
load certification, disaster-recovery drill or verification of a public Cloudflare tunnel.

## What is already separated

- Eight NestJS processes have distinct service roles and PostgreSQL databases/users.
  Startup checks the selected database against the declared owner role.
- Nginx routes public APIs by domain of responsibility. Cross-owner writes are rejected
  by the compatibility adapter; owner command APIs exist for selected audio operations.
- Redis supports Arena and Socket.IO; RabbitMQ runs durable audio/ASR jobs and an
  event relay; SeaweedFS provides S3-compatible media storage.
- A single repository/shared build image is compatible with deploying distinct services.
  The physical PostgreSQL server is shared, while databases and service users are separate.

These are microservice deployment boundaries, but the following source-level issues
prevent a blanket production-ready assessment.

## Required follow-up work

| Priority | Finding and source | Consequence / completion condition |
| --- | --- | --- |
| High | `apps/api/src/postgres/compat.ts` reads tables with SELECT * and evaluates document filters in memory; `apps/api/src/internal/read-models.module.ts` exports whole owner tables over HTTP using one shared token. | Unbounded CPU, memory and network growth; broad internal access to sensitive business rows. Replace with bounded owner APIs/projections, SQL filtering/pagination and caller-specific authorization. Internal HTTP avoids cross-DB access but does not provide a scalable read contract. |
| High | `apps/api/src/modules/assessment/exams/exams.service.ts` saves the exam before separately enqueueing an outbox event and catches publish-storage errors; user creation has the same pattern. | State can exist without its event. Commit state and outbox in the same PostgreSQL transaction, then test crash/retry behavior. The outbox helper accepts a transaction client, but these callers do not use it. |
| High | `services/domain-events/consumer.py` records inbox receipt, prints and ACKs; business projection handlers are explicitly left unimplemented. | Running consumers do not demonstrate that dependent business state is updated. Implement transactional, idempotent handlers with retry/dead-letter handling and reconciliation. |
| High | `apps/api/src/common/clients/learning-activity-client.ts` records XP through best-effort HTTP and returns false on failure. | A completed attempt/game can miss learning credit during an outage. Use a durable event with replay and reconciliation. |
| High before scaling workers | `apps/api/src/modules/audio-processing/audio-queue.service.ts` claims leases through ordinary document findOneAndUpdate; the adapter locks attempts/pipeline updates, not ordinary audio_jobs updates. | Concurrent execution can claim the same job. Replace with atomic SQL compare-and-update/RETURNING, retain lease-owner checks and verify concurrent delivery, crashes and expired leases. A single current consumer does not prove safety under scale-out. |
| High before releasing schema changes | SQL init runs only on a new volume; repairs are manual and unversioned. | Existing deployments can drift. Add ordered, checksum-verified migrations, migration status/checks in deployment, and a tested backup/restore procedure. Do not overwrite a live schema from init on every build. |
| Release validation | `apps/api/src/platform/platform.module.ts` health is static; no dependency-aware readiness. Single-host Compose with single PostgreSQL/Redis/RabbitMQ/storage instances. | Define required availability and recovery targets, probe dependencies, monitor queue lag/errors/resources and test restore/restart behavior. HA should follow the product's availability requirements. |
| Release validation | Shared internal secrets, broad Docker network, mixed pinned/unpinned dependencies/images and default seed-admin workflow. | Separate service permissions, audit secret rotation, disable unnecessary bootstrap admin seeding for public release, pin tested artifacts and run CI/security checks. |

## Domain configuration in this change

`compose.edge.yml` adds an optional hostname-based Nginx ingress and token-based
cloudflared connector. Web/admin hosts can proxy `/api`, `/media` and Socket.IO locally
to support unrelated domains. API and WebSocket origin checks share the env allowlist.
User/admin refresh cookies have separate names/scopes, auto or explicit HTTPS Secure
flags and matching logout deletion options. Gateway preserves forwarded HTTPS,
streaming and WebSocket headers; published application origin ports default to loopback.

These changes prepare domain deployment. They do not resolve the business consistency,
query scalability, schema lifecycle and operational issues above. Follow
[DEPLOYMENT.md](DEPLOYMENT.md) for env, hostname aliases, rebuild/recreate commands,
OAuth limitations and the checks that require real public hostnames.

## Verification of this change

- Docker builds succeeded for the shared API image, web and admin-web.
- Focused origin/proxy/cookie regression tests: 13/13 passed
  (`docker compose run --rm --no-deps identity-service pnpm --dir apps/api exec vitest run src/platform/http-policy.spec.ts`).
- Gateway and generated edge Nginx configuration syntax passed.
- Local ingress probe: 23/23 passed across web/admin/API hostnames, unknown hosts,
  internal-route blocking, CORS preflight, HTTPS forwarding, media routing, allowed/denied
  WebSocket upgrades and existing-admin login -> profile -> refresh -> logout.
- Read-only cross-service network smoke: 15/15 passed. Schema contract check also passed.
- Application services are running locally; edge is healthy on 127.0.0.1:8080. Existing
  direct frontend/API ports remain available on loopback. Existing credentials were
  preserved while missing nonsecret deployment settings were appended to root .env.

The current .env retains localhost URLs. Public DNS/TLS/Tunnel, real-domain browser
cookies, Google callbacks and the final same-origin frontend build must be verified
when deployment values are selected. No public tunnel was connected in this review.
These checks do not establish load capacity, transactional event delivery or recovery
guarantees for the unresolved issues above.
