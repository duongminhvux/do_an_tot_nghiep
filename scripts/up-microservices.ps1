param([switch]$Gpu)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$env:API_PUBLISH_HOST = '127.0.0.1'
$env:API_PUBLISHED_PORT = '5009'
$env:GATEWAY_PUBLISHED_PORT = '5000'
$compose = @('-f','docker-compose.yml','-f','infra/compose/storage.yml',
  '-f','infra/compose/rabbitmq.yml','-f','infra/compose/microservices.yml',
  '-f','infra/compose/asr-jobs.yml','-f','infra/compose/domain-events.yml')
if ($Gpu) { $compose += @('-f','docker-compose.gpu.yml','-f','docker-compose.ai.yml',
    '-f','infra/compose/ollama-init.yml','-f','infra/compose/ai-import-worker.yml') }
docker compose @compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Compose config validation failed' }
docker compose @compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Compose startup failed. See logs before switching traffic.' }
Write-Host 'Gateway http://localhost:5000 | Legacy fallback http://127.0.0.1:5009'
