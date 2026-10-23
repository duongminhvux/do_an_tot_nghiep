#Requires -Version 5.1
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$target=Join-Path $root 'backups'; New-Item -ItemType Directory -Force -Path $target | Out-Null
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$container=(& docker compose -f (Join-Path $root 'docker-compose.yml') ps -q postgres).Trim()
if (-not $container){throw 'PostgreSQL Docker container is not running.'}
$superuser=if($env:PG_SUPERUSER){$env:PG_SUPERUSER}else{'vocalearn_root'}
foreach($domain in @('identity','content','assessment','arena','learning','media','ai_import','notification')) {
  $db=$domain+'_db';$archive='/tmp/'+$db+'-'+$stamp+'.dump'
  & docker exec $container pg_dump -U $superuser -d $db -Fc -f $archive
  if($LASTEXITCODE -ne 0){throw "pg_dump failed for $db"}
  $dst=Join-Path $target ($db+'-'+$stamp+'.dump')
  & docker cp "${container}:$archive" "$dst"
  if($LASTEXITCODE -ne 0){throw "docker cp failed for $db"}
  & docker exec $container rm -f $archive | Out-Null
  Write-Host "Backup: $dst"
}
