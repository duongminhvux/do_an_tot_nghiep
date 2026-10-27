# Domains, Nginx and Cloudflare Tunnel

The current code has eight independently running NestJS roles and eight owner databases.
It is a transitional microservice deployment, not yet verified as production-ready.
See [PRODUCTION_REVIEW.md](PRODUCTION_REVIEW.md) for the remaining issues.
The database client is PostgreSQL `pg`; PostgREST is not part of this deployment.

## Traffic layout

```text
Browser HTTPS -> Cloudflare -> cloudflared -> edge:8080
  web hostnames   -> web:3000
  admin hostnames -> admin-web:3001
  /api/* on every configured hostname -> gateway:5000 -> owner service
  /socket.io/* -> gateway -> arena-service
  /media/* -> gateway -> media-jobs-service -> object storage
```

Use the same-origin API on each web/admin hostname, even if a separate API hostname
also exists. This supports unrelated domains without cross-site refresh cookies.
Sessions stay on the hostname where the user signed in; aliases do not provide SSO.
User/admin refresh cookies have distinct names, auth-only paths, HttpOnly and host-only
scope. Existing `refresh_token` cookies can migrate on the next successful refresh.

## One root .env

Keep existing database, queue, storage and JWT secrets. Change these deployment values
in root `.env` when the real domains are available:

```dotenv
# Primary URLs used for redirects and cookie HTTPS detection.
FRONTEND_URL=https://learn.example.com
ADMIN_URL=https://admin.example.com
# Additional exact origins. Comma-separated, with https://, no path or wildcard.
# The two primary URLs above are always allowed too.
CORS_ALLOWED_ORIGINS=https://learn.second-example.net,https://admin.second-example.net

# Host routing. Space-separated names, without protocol, path or port.
# A hostname must appear in only one group. Keep at least one hostname per group.
WEB_HOSTS="learn.example.com learn.second-example.net"
ADMIN_HOSTS="admin.example.com admin.second-example.net"
API_HOSTS="api.example.com api.second-example.net"

# Browser paths are independent of the hostname. Rebuild once when switching to these.
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_ARENA_SOCKET_URL=/arena
MEDIA_PUBLIC_BASE_URL=/media

COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
TRUST_PROXY_HOPS=1
PUBLIC_BIND_ADDRESS=127.0.0.1
EDGE_PUBLISHED_PORT=8080

# Register this exact callback in the Google OAuth console.
GOOGLE_CALLBACK_URL=https://learn.example.com/api/auth/google/callback
CLOUDFLARE_TUNNEL_TOKEN=your-remotely-managed-tunnel-token
# Replace latest with a tested release tag/digest before a production release.
CLOUDFLARED_IMAGE=cloudflare/cloudflared:latest
```

`COOKIE_SECURE=auto` is the default: HTTPS primary URLs enable Secure cookies; HTTP
localhost works even though the Docker image uses NODE_ENV=production. Use `true`
for an HTTPS deployment. SameSite=None is rejected unless cookies are Secure.
For unrelated domains use `/api` on each hostname; adding CORS alone cannot override
browser restrictions on third-party cookies. Cookie Domain is intentionally omitted.

Google login currently redirects to the canonical FRONTEND_URL. Logging in through an
alias may therefore finish on the primary hostname. Per-alias OAuth callbacks and SSO
are separate features; do not expect CORS aliases to implement them.

New media URLs use the configured base. Existing database content containing absolute
`http://localhost:5000/media/...` URLs needs a separately reviewed data migration before
public use; changing env does not rewrite stored URLs.

## Build and start the origin

From the repository root, after changing env:

```powershell
docker compose -f docker-compose.yml -f compose.edge.yml config --quiet
docker compose build identity-service web admin-web
docker compose -f docker-compose.yml -f compose.edge.yml up -d
```

No tunnel starts unless the `tunnel` profile is explicitly enabled. Regular
`docker compose up -d` keeps the existing localhost ports 3000, 3001 and 5000, bound
to loopback by default. Leave the existing absolute localhost API/socket env values
when using those direct ports. To test same-origin mode locally, use edge hosts with
NEXT_PUBLIC_API_URL=/api and NEXT_PUBLIC_ARENA_SOCKET_URL=/arena, and add their exact
HTTP origins (including :8080) to CORS_ALLOWED_ORIGINS, for example:
`http://localhost:8080,http://admin.localhost:8080`. Use COOKIE_SECURE=false locally.

Changes to NEXT_PUBLIC_* require rebuilding the frontend images because Next.js embeds
them during build. After choosing relative paths, adding/changing domains only requires
updating env, recreating edge, recreating API services to reload the allowlist/canonical
URLs, and updating Cloudflare routes. Run `up -d --force-recreate edge` to regenerate
the Nginx hostname template; a bare Nginx reload does not re-run envsubst.

## Connect Cloudflare

Create a remotely managed tunnel. Add a published application route for **each**
hostname in WEB_HOSTS, ADMIN_HOSTS and API_HOSTS, all targeting `http://edge:8080`
when cloudflared runs in this Compose network. Preserve the incoming Host header;
leave the HTTP Host Header override empty, otherwise Nginx cannot distinguish sites.
For a connector installed directly on this machine, use `http://127.0.0.1:8080` instead.
DNS and tunnel routes must be configured for every domain/zone you control.

Then start the optional connector:

```powershell
docker compose -f docker-compose.yml -f compose.edge.yml --profile tunnel up -d cloudflared
docker compose -f docker-compose.yml -f compose.edge.yml logs --tail 50 edge cloudflared
```

Cloudflare handles public TLS. Enable HTTPS redirects there and bypass caching for
`/api/*` and `/socket.io/*`; auth responses also carry `Cache-Control: private, no-store`.
Use async job submission/status endpoints for long AI work: increasing Nginx's timeout
does not remove the Cloudflare edge timeout. Upload limits also depend on your plan.
Never route the tunnel to PostgreSQL, Redis, RabbitMQ, storage admin ports or a service
directly. `/api/_internal` is blocked at edge and gateway.

The origin trusts its local ingress for forwarded protocol; keep origin ports private.
Do not set PUBLIC_BIND_ADDRESS=0.0.0.0 without a separate firewall/proxy trust design.
TRUST_PROXY_HOPS=1 trusts the nearest gateway for Express protocol handling. Client IP
logging currently records proxy peers; forwarding CF-Connecting-IP as a verified visitor
IP requires an additional explicit trusted-proxy policy.

## Verify after deploying

```powershell
docker compose -f docker-compose.yml -f compose.edge.yml exec -T edge nginx -t
docker compose exec -T gateway nginx -t
node scripts/check-gateway-contract.cjs
node scripts/check-client-gateway-routes.cjs
docker compose exec -T identity-service node scripts/smoke-network.mjs
curl.exe -I https://learn.example.com/
curl.exe -i -X OPTIONS https://learn.example.com/api/auth/login -H "Origin: https://learn.example.com" -H "Access-Control-Request-Method: POST"
curl.exe -i -X OPTIONS https://learn.example.com/api/auth/login -H "Origin: https://unlisted.example" -H "Access-Control-Request-Method: POST"
curl.exe -i https://learn.example.com/api/_internal/read-models/users
```

Check `/gateway/identity-ready` through `/gateway/notification-ready` (eight named
role probes including `media-jobs` and `ai-import`) to verify backend dependencies.
The `/gateway/health` and `/api/health` endpoints only report Nginx liveness.
The gateway now waits for each role's Docker healthcheck before starting, and web/admin
wait for the gateway healthcheck. These probes do not replace authenticated E2E tests.

Expect the configured-origin preflight to succeed with the exact allow-origin and
credentials headers, the unlisted origin to return 403, and the internal URL to return
404. Test login -> refresh -> logout separately on web and admin, then test Arena's
WebSocket connection and media/range playback through the real HTTPS hostnames.
The configuration can be tested locally without credentials; public TLS/DNS/Tunnel
and Google OAuth require real domain and account settings.

References: [Cloudflare tunnel setup](https://developers.cloudflare.com/tunnel/get-started/),
[tunnel token env](https://developers.cloudflare.com/tunnel/reference/run-parameters/),
[forwarded protocol](https://developers.cloudflare.com/fundamentals/reference/http-headers/),
[Express proxy trust](https://expressjs.com/en/guide/behind-proxies/),
[Next.js build-time public env](https://nextjs.org/docs/app/guides/environment-variables).
