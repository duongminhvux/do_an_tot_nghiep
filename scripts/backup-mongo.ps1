param([string]$DbName = "english-platform", [string]$BackupDir = "backups/mongodb")
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
if ($DbName -notmatch '^[a-zA-Z0-9_-]+$') { throw "Invalid database name" }
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
$Stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$Filename = "${DbName}_${Stamp}.archive.gz"
$InContainer = "/tmp/$Filename"
$Local = Join-Path $BackupDir $Filename
try {
    & docker compose exec -T mongo mongodump --db $DbName --archive=$InContainer --gzip
    if ($LASTEXITCODE -ne 0) { throw "mongodump failed" }
    & docker compose cp "mongo:$InContainer" $Local
    if ($LASTEXITCODE -ne 0) { throw "docker compose cp failed" }
    if ((Get-Item $Local).Length -le 0) { throw "Backup file is empty" }
    $Hash = (Get-FileHash -Algorithm SHA256 $Local).Hash
    "$Hash  $Filename" | Set-Content -Path "$Local.sha256" -Encoding ascii
    Write-Host "Backup saved: $Local"
} finally {
    & docker compose exec -T mongo rm -f $InContainer | Out-Null
}
