# Repairs existing PostgreSQL volumes without deleting rows or columns.
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $projectRoot
try {
  $bootstrapUser = & docker compose exec -T postgres printenv POSTGRES_USER
  if ($LASTEXITCODE -ne 0) { throw 'Cannot read PostgreSQL bootstrap user' }
  $bootstrapUser = ($bootstrapUser | Out-String).Trim()
  if (-not $bootstrapUser) { throw 'POSTGRES_USER is missing' }
  Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'database/postgres/repair-assessment-pdf-ai.sql') |
    & docker compose exec -T postgres psql -X -U $bootstrapUser -d assessment_db -v ON_ERROR_STOP=1 --single-transaction
  if ($LASTEXITCODE -ne 0) { throw 'Assessment outbox repair failed; transaction rolled back' }
  Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'database/postgres/repair-content-nested-fields.sql') |
    & docker compose exec -T postgres psql -X -U $bootstrapUser -d content_db -v ON_ERROR_STOP=1 --single-transaction
  if ($LASTEXITCODE -ne 0) { throw 'Content nested-field repair failed; transaction rolled back' }
  Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'database/postgres/repair-dictation-progress-arrays.sql') |
    & docker compose exec -T postgres psql -X -U $bootstrapUser -d content_db -v ON_ERROR_STOP=1 --single-transaction
  if ($LASTEXITCODE -ne 0) { throw 'Dictation progress array repair failed; transaction rolled back' }
  Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'database/postgres/repair-arena-nested-fields.sql') |
    & docker compose exec -T postgres psql -X -U $bootstrapUser -d arena_db -v ON_ERROR_STOP=1 --single-transaction
  if ($LASTEXITCODE -ne 0) { throw 'Arena nested-field repair failed; transaction rolled back' }
  Write-Host 'Assessment PDF correction outbox is ready. Existing data retained.'
  Write-Host 'Content nested fields no longer require phantom root values. Existing data retained.'
  Write-Host 'Dictation completed/revealed segment lists use JSONB arrays.'
  Write-Host 'Arena nested fields no longer require phantom root values. Existing data retained.'
} finally {
  Pop-Location
}
