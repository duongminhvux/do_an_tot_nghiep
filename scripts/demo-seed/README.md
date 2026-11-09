# Synthetic demo data

Run from the repository root with Node 24 and the installed pnpm workspace. The root `.env` supplies the existing service PostgreSQL credentials and is never overwritten.

## Local workflow (PowerShell)

```powershell
pnpm --dir apps/api exec tsc -p tsconfig.docker.json
pnpm --dir apps/api exec tsc -p ../../scripts/demo-seed/tsconfig.json
pnpm test:demo
$env:DEMO_SEED_ENABLED = 'true'
$env:DEMO_ENVIRONMENT = 'local'
pnpm seed:demo:plan
pnpm seed:demo
pnpm seed:demo:verify
pnpm seed:demo:reset --dry-run
```

Defaults: 1,000 users, 90 days, 2,000 Arena matches. `DEMO_PROFILE=small` defaults to 50 users; `large` to 5,000. Explicit `DEMO_USER_COUNT` and `DEMO_ARENA_MATCH_COUNT` override profile defaults. For `large`, deliberately set `DEMO_MAX_RECORDS=2000000`. The plan rejects a record budget overflow before writes, including active-time slices.

Write protection requires opt-in, an allowed `DEMO_ENVIRONMENT`, a local host and canonical schema readiness. Ambiguous `DATABASE_URL` targets are refused. Each database uses its own non-superuser account and a session advisory lock shared by seed, verify and reset. Connection readiness retries are bounded; failure returns nonzero.

## Content and presenter credentials

Seed requires published TOEIC exams with valid options/passages, complete published vocabulary lessons and published Dictation lessons with real segments. Missing content fails explicitly.

If Dictation is empty, use `pnpm seed:demo:content`. This uses `DEMO_ADMIN_EMAIL`/`DEMO_ADMIN_PASSWORD`, falling back to `DEFAULT_ADMIN_*`, to authenticate an existing authorized administrator. It creates a topic/section and three reusable lessons through the existing API, generates audio, validates and publishes. Subsequent runs reuse lesson slugs. These shared lessons/media are retained by demo cleanup. No ASR or audio generation runs per learner.

Default accounts have unique random discarded passwords hashed with the application's bcrypt cost; no emails are sent. Before the first seed, optionally set `DEMO_LOGIN_COUNT=1` (maximum 5) and `DEMO_LOGIN_PASSWORD` to a secret of at least 16 characters. Presenter accounts start at `demo.user0001@example.com` / `demo_0001`. Then `pnpm seed:demo:api` verifies real authenticated gateway routes, using existing admin credentials for admin checks. Tokens, passwords and hashes are never written to reports.

This implementation session created one presenter using a random secret in the gitignored file `.tmp/demo-login-secret`. Reuse it without printing the secret:

```powershell
$env:DEMO_LOGIN_PASSWORD = Get-Content -Raw .tmp/demo-login-secret
$env:DEMO_LOGIN_COUNT = '1'
pnpm seed:demo:api
```

Existing hashes are preserved on rerun. Changing the environment variable does not silently reset passwords; use the application's normal password management flow for rotation.

## Determinism and recovery

UUIDs derive from namespace `vocalearn.synthetic.v1` and stable keys. A seeded PRNG controls business randomness. The first demo user's existing JSONB payload stores the anchor, configuration and content fingerprint. `DEMO_ANCHOR_DATE` can pin the first anchor. Reruns reuse the saved anchor and reject conflicting configuration/content.

Each owner commits one transaction. A failed owner rolls back; earlier checkpoints remain valid. Rerunning inserts missing stable IDs only. Learning activities use `LearningActivityService.record`, retaining its exactly-once XP ledger. SRS uses the same extracted function as both live review APIs. TOEIC result calculation, estimated conversion, Arena speed scoring and Elo come from the built application. Build after changing those modules.

Identity writes normal transactional outbox events. Existing relays/consumers populate their own display profiles. The runner does not forge remote projections, Redis presence or sockets. Verification waits for consumer convergence. Start the usual application stack, including relays and domain consumers, before seeding.

## Docker

```powershell
docker compose up -d --build
$env:DEMO_SEED_ENABLED = 'true'
$env:DEMO_ENVIRONMENT = 'local'
docker compose --profile demo build demo-seed
docker compose --profile demo run --rm demo-seed
docker compose --profile demo run --rm demo-seed node scripts/demo-seed/run.ts verify
docker compose --profile demo run --rm demo-seed node scripts/demo-seed/run.ts reset --dry-run
```

The opt-in one-shot service uses the existing API image, healthy PostgreSQL, completed schema migration, Identity relay and consumers. The runner additionally checks readiness and projections rather than relying only on startup order. JSON reports mount back to `scripts/demo-seed/reports`.

## Cleanup

Preview first. Actual deletion requires write flags and namespace-specific confirmation:

```powershell
pnpm seed:demo:reset --dry-run
pnpm seed:demo:reset --confirm=vocalearn.synthetic.v1
```

Ownership requires namespace, stable key and derived UUID. Dependents are removed before users. Credits use exact demo users/namespaced source keys; active-time UUIDs must derive from owned sessions. Shared learning content/media and administrators remain intact. Delivery receipts remain as durable deduplication metadata.

Actual cleanup refuses ambiguous ownership, undrained Identity delivery or non-seed activity on demo accounts. Normal UI tracking after presenter login may therefore prevent account deletion; the guard is intentional. Dry-run reports eligible counts and blockers without deleting. Tests exercise actual deletion only in isolated PostgreSQL schemas and retain unrelated sentinel users/content.

To change profile on an already seeded database, review cleanup or use a separate development environment. The runner never silently replaces another configuration.

## Optional simulation and evidence

Bots and a periodic simulator are not installed. Keep `DEMO_SIMULATOR_ENABLED=false`; true fails explicitly. Historical seed does not fake online users, enqueue mass emails or perform AI inference per learner.

`reports/plan.json`, `seed.json`, `verify.json`, `api.json`, `cleanup.json` contain run evidence without credentials. Integration tests use five independent migrated PGlite PostgreSQL databases, including rollback/resume, repeated seed, XP ledger and exact cleanup. See the root implementation report for observed local Docker counts and browser checks.
