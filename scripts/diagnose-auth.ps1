# From the project root: powershell -ExecutionPolicy Bypass -File .\scripts\diagnose-auth.ps1
$ErrorActionPreference = 'Continue'
Write-Host "`n=== Compose services ==="
docker compose ps -a
Write-Host "`n=== Identity and Notification service logs ==="
docker compose logs --tail=70 identity-service notification-service gateway
$root = 'http://localhost:5000'
Write-Host "`n=== Gateway probes (direct HTTP; no credentials) ==="
foreach ($endpoint in @('/gateway/health', '/gateway/identity-health', '/gateway/notification-health')) {
  Write-Host "GET $root$endpoint"
  curl.exe --max-time 7 -sS -o NUL -w 'HTTP %{http_code}' "$root$endpoint"
  Write-Host ''
}
Write-Host "GET $root/api/auth/google/login (302 if enabled, 503 if disabled; 404/502 indicates routing/backend issues)"
curl.exe --max-time 7 -sS -o NUL -w 'HTTP %{http_code}' "$root/api/auth/google/login"
Write-Host ''
Write-Host "POST $root/api/admin/auth/login with EMPTY BODY (400/401 means route exists, NOT a valid login)"
curl.exe --max-time 7 -sS -o NUL -w 'HTTP %{http_code}' -H 'Content-Type: application/json' -X POST -d '{}' "$root/api/admin/auth/login"
Write-Host ''
Write-Host "`n=== Browser API configuration from Compose (not secrets) ==="
Write-Host "NEXT_PUBLIC_API_URL (build-time; check the Request URL in browser DevTools):"
$cfg = docker compose config --format json | ConvertFrom-Json
Write-Host "web: $($cfg.services.web.build.args.NEXT_PUBLIC_API_URL)"
Write-Host "admin: $($cfg.services.'admin-web'.build.args.NEXT_PUBLIC_API_URL)"
