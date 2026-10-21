param([switch]$Gpu)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$env:API_PUBLISH_HOST = '127.0.0.1'
$env:API_PUBLISHED_PORT = '5009'
$compose = @('-f','docker-compose.yml','-f','infra/compose/storage.yml',
  '-f','infra/compose/rabbitmq.yml','-f','infra/compose/microservices.yml',
  '-f','infra/compose/asr-jobs.yml','-f','infra/compose/domain-events.yml')
if ($Gpu) { $compose += @('-f','docker-compose.gpu.yml',
  '-f','docker-compose.ai.yml','-f','infra/compose/ollama-init.yml',
  '-f','infra/compose/ai-import-worker.yml') }
docker compose @compose down
# No -v flag: preserve MongoDB/Redis/RabbitMQ/MinIO/model volumes.
