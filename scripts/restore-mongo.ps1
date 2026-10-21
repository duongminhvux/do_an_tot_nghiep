param([Parameter(Mandatory=$true)][string]$Backup, [string]$DbName = "english-platform")
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($DbName -notmatch '^[a-zA-Z0-9_-]+$') { throw "Invalid database name" }
$Path = (Resolve-Path $Backup).Path
$InputName = Split-Path $Path -Leaf
$InContainer = "/tmp/$InputName"
$Answer = Read-Host "Type RESTORE to import into '$DbName' without --drop"
if ($Answer -cne 'RESTORE') { throw "Canceled" }
try {
    & docker compose cp $Path "mongo:$InContainer"
    if ($LASTEXITCODE -ne 0) { throw "Upload backup to container failed" }
    & docker compose exec -T mongo mongorestore --db $DbName --archive=$InContainer --gzip
    if ($LASTEXITCODE -ne 0) { throw "mongorestore failed" }
    Write-Host 'Restore finished. Verify data.'
} finally {
    & docker compose exec -T mongo rm -f $InContainer | Out-Null
}
