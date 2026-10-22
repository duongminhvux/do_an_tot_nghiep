# Manual backup of the NEW MongoDB instance (all microservice databases).
# This does not stop containers, erase volumes, or execute any migration.
param([string]$BackupDir = 'backups/mongodb')
$ErrorActionPreference='Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
# Resolve the running Compose MongoDB container without the fragile ps -q pipeline.
$mongoPs = @(& docker compose ps --all --format json mongo)
$mongoPsExit = $LASTEXITCODE
if ($mongoPsExit -ne 0) { throw "Docker Compose query failed (exit code $mongoPsExit)" }
$mongoJson = ($mongoPs -join "`n").Trim()
if (-not $mongoJson) { throw 'MongoDB service not found: docker compose ps -a mongo' }
try { $mongoEntries = @(ConvertFrom-Json -InputObject $mongoJson) }
catch { throw "Cannot parse Docker Compose MongoDB metadata: $_" }
$runningMongo = @($mongoEntries | Where-Object { $_.Service -eq 'mongo' -and $_.State -eq 'running' } | Select-Object -First 1)
if ($runningMongo.Count -eq 0 -or -not $runningMongo[0].ID) {
  throw 'MongoDB is not running: docker compose ps -a mongo'
}
$container = [string]$runningMongo[0].ID
Write-Host "Backing up MongoDB container: $($runningMongo[0].Name)"
$stamp=(Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$basename="vocalearn_all_${stamp}.archive.gz"
$inside="/tmp/$basename"
$destination=Join-Path (Resolve-Path $BackupDir).Path $basename
try {
  & docker exec $container mongodump --gzip --archive=$inside
  if($LASTEXITCODE -ne 0){throw 'mongodump failed'}
  & docker cp "${container}:${inside}" $destination
  if($LASTEXITCODE -ne 0){throw 'docker cp failed'}
  $digest=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
  Set-Content -LiteralPath "$destination.sha256" -Value "$digest  $basename" -Encoding ASCII
  Write-Host "BACKUP: $destination"
  Write-Host "SHA256: $digest"
} finally {
  & docker exec $container rm -f $inside | Out-Null
}
Write-Warning 'For a consistent production backup across simultaneous service writes, use a coordinated backup snapshot with the MongoDB oplog; this convenience script is for manual backup.'
