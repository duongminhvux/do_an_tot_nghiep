# Run from the project root, after docker compose up -d --build.
# Checks container state and calls a read-only network smoke inside Identity.
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
& docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration is invalid' }
Write-Host "`n=== Service state ==="
& docker compose ps -a
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose ps failed' }
Write-Host "`n=== API/HTTP connectivity ==="
& docker compose exec -T identity-service node scripts/smoke-network.mjs
if ($LASTEXITCODE -ne 0) { throw 'One or more API connectivity checks failed; inspect docker compose logs for that service.' }
Write-Host "`nAPI connectivity OK. For projection delivery, check relay/consumer logs and queues separately."
