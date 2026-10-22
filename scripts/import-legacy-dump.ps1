# Standalone legacy data import; NEVER called by docker compose up/build.
# Windows PowerShell 5.1+; supports raw mongodump --archive and --archive --gzip.
# MongoDB must already be running with the fresh microservice schema.
param(
  [Parameter(Mandatory=$true)][string]$Dump,
  [switch]$Apply,
  [switch]$Verify,
  [string]$ExpectedSha256 = ''
)
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Invoke-Docker([string[]]$Arguments) {
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Docker command failed: docker $($Arguments -join ' ')" }
}
function Run-Importer([string]$Mode) {
  Invoke-Docker -Arguments @('compose', 'run', '--rm', '--no-deps',
    '-e', 'LEGACY_IMPORT_URI=mongodb://mongo:27017/legacy_import?replicaSet=rs0',
    '-e', 'MONGO_ADMIN_URI=mongodb://mongo:27017/?replicaSet=rs0',
    '-e', "LEGACY_IMPORT_CONFIRMED=$(if ($Mode -eq '--apply') {'YES'} else {'NO'})",
    'identity-service', 'node', 'apps/api/src/scripts/import-legacy.mjs', $Mode)
}
if (-not (Test-Path -LiteralPath $Dump -PathType Leaf)) { throw "Dump not found: $Dump" }
$path = (Resolve-Path -LiteralPath $Dump).Path
$file = Get-Item -LiteralPath $path
if ($file.Length -lt 64) { throw 'Backup file is suspiciously small; aborting' }
$sha = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
if (-not $ExpectedSha256) {
  foreach ($sidecar in @("$path.sha256", [IO.Path]::ChangeExtension($path, '.sha256'))) {
    if (Test-Path -LiteralPath $sidecar) {
      $ExpectedSha256 = ((Get-Content -LiteralPath $sidecar -TotalCount 1) -split '\s+')[0]
      break
    }
  }
}
if ($ExpectedSha256) {
  if ($ExpectedSha256.ToLowerInvariant() -ne $sha) { throw 'SHA256 does not match backup sidecar; STOP' }
  Write-Host "SHA256 verified: $sha"
} else {
  Write-Warning "No matching .sha256 sidecar for this dump. Computed SHA256: $sha"
}
# Use Compose JSON instead of the quiet/Select-Object pipeline.  The latter can
# return an empty value or a nonzero pipeline exit code on some Windows shells.
# A completed one-shot db-init container is expected to be Exited (0); only
# MongoDB itself needs to be running here.
$mongoPs = @(& docker compose ps --all --format json mongo)
$mongoPsExit = $LASTEXITCODE
if ($mongoPsExit -ne 0) {
  throw "Cannot inspect MongoDB via Docker Compose (exit code $mongoPsExit). Run: docker compose ps -a mongo"
}
$mongoJson = ($mongoPs -join "`n").Trim()
if (-not $mongoJson) { throw 'MongoDB service not found in this Compose project. Run: docker compose ps -a mongo' }
try {
  $mongoEntries = @(ConvertFrom-Json -InputObject $mongoJson)
} catch {
  throw "Cannot parse Docker Compose service metadata. Run: docker compose ps --all --format json mongo. Details: $_"
}
$runningMongo = @($mongoEntries | Where-Object { $_.Service -eq 'mongo' -and $_.State -eq 'running' } | Select-Object -First 1)
if ($runningMongo.Count -eq 0 -or -not $runningMongo[0].ID) {
  throw 'MongoDB container exists but is not running. Check: docker compose ps -a mongo'
}
$container = [string]$runningMongo[0].ID
Write-Host "Using MongoDB container: $($runningMongo[0].Name) ($($container.Substring(0, [Math]::Min(12, $container.Length))))"
# IMPORTANT for Windows PowerShell 5.1: do not pass embedded JS double quotes
# through a native docker.exe --eval argument. They can be stripped by the Windows
# native-argument parser, turning getSiblingDB("identity_db") into getSiblingDB(identity_db).
# Use JavaScript single-quoted strings inside PowerShell double-quoted strings.
function Invoke-MongoJs([string]$Code) {
  if ($Code.Contains('"')) { throw 'Internal script error: use JavaScript single-quoted string literals for mongosh --eval' }
  $result = @(& docker exec $container mongosh --quiet --eval $Code)
  $mongoExit = $LASTEXITCODE
  if ($mongoExit -ne 0) { throw "MongoDB query failed (mongosh exit code $mongoExit). See error above." }
  return (($result | Out-String).Trim())
}
$health = Invoke-MongoJs "print(db.getSiblingDB('identity_db').getCollection('database_versions').findOne({_id:'initial_schema_v1'}) !== null)"
if ($health -ne 'true') {
  throw "Fresh DB schema marker missing in identity_db (received '$health'); check docker compose logs db-init"
}

# If source was staged by a previous -Plan call, verify it came from the very same dump.
$stageCheck = "const c=db.getSiblingDB('legacy_import');const m=c._import_metadata.findOne({_id:'source_dump'});print(m?m.sha256:'NONE')"
$existing = Invoke-MongoJs $stageCheck
if ($existing -eq 'NONE') {
  $count = Invoke-MongoJs "print(db.getSiblingDB('legacy_import').getCollectionNames().length)"
  if ($count -ne '0') { throw 'legacy_import contains data without source metadata. Refusing to overwrite.' }
  $f = [IO.File]::OpenRead($path)
  try {
    $first=$f.ReadByte();$second=$f.ReadByte()
  } finally { $f.Dispose() }
  $gzip = ($first -eq 31 -and $second -eq 139)
  $inside='/tmp/legacy-import.archive'
  Write-Host 'Copying dump into MongoDB container for validation...'
  Invoke-Docker -Arguments @('cp',$path, "${container}:${inside}")
  try {
    $args=@('exec',$container,'mongorestore','--dryRun',"--archive=$inside",'--nsInclude=english-platform.*','--stopOnError')
    if($gzip){$args+='--gzip'}
    Write-Host 'Checking MongoDB archive format (dry run)...'
    Invoke-Docker -Arguments $args
    $args=@('exec',$container,'mongorestore',"--archive=$inside",'--nsInclude=english-platform.*',
       '--nsFrom=english-platform.*','--nsTo=legacy_import.*','--stopOnError')
    if($gzip){$args+='--gzip'}
    Write-Host 'Restoring source to temporary legacy_import database (NOT the business DBs)...'
    Invoke-Docker -Arguments $args
    $metadata="db.getSiblingDB('legacy_import')._import_metadata.updateOne({_id:'source_dump'}, {`$set:{sha256:'$sha',importedAt:new Date()}}, {upsert:true})"
    $null = Invoke-MongoJs $metadata
  } finally { & docker exec $container rm -f $inside | Out-Null }
} elseif ($existing -ne $sha) {
  throw "Staging database belongs to a different dump ($existing). No data was modified."
} else {
  Write-Host 'Reusing previously restored legacy_import staging database.'
}

$stageCount=Invoke-MongoJs "print(db.getSiblingDB('legacy_import').getCollectionNames().length)"
$stageCountNumeric=0
if (-not [int]::TryParse($stageCount, [ref]$stageCountNumeric) -or $stageCountNumeric -le 1) {
  throw "Legacy staging database has no source collections or returned unexpected count '$stageCount'; check archive namespace"
}
Write-Host 'Reviewing database ownership plan...'
Run-Importer '--plan'

if ($Verify) {
  Run-Importer '--verify'
  exit 0
}
if (-not $Apply) {
  Write-Host 'PLAN ONLY. No business database was populated.'
  Write-Host 'To import: .\scripts\import-legacy-dump.ps1 -Dump "D:\english-platform.dump" -Apply'
  exit 0
}
Write-Warning 'This will import old data into the new service databases. Stop all website/API writes first.'
$confirm=Read-Host 'Type IMPORT to proceed'
if ($confirm -cne 'IMPORT') { throw 'Cancelled; source backup remains untouched' }
$keep=@('mongo','db-init','rabbitmq','redis','objectstore')
$running = @(& docker compose ps --services --filter status=running)
if ($LASTEXITCODE -ne 0) { throw 'Unable to list running services' }
$toStop=@($running | Where-Object { $keep -notcontains $_ })
if ($toStop.Count -gt 0) {
  Write-Host "Stopping business services to avoid concurrent writes: $($toStop -join ', ')"
  Invoke-Docker -Arguments (@('compose','stop') + $toStop)
}
Run-Importer '--apply'
Run-Importer '--verify'
Write-Host 'Legacy import verified. Restart application: docker compose up -d --no-build'
