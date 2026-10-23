#Requires -Version 5.1
# PostgreSQL must be installed and running locally; psql.exe must be in PATH.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) { throw 'Copy .env.example to .env first' }
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $key=$matches[1]; $value=$matches[2].Trim().Trim('"').Trim("'")
    [Environment]::SetEnvironmentVariable($key,$value,'Process')
  }
}
$psql=Get-Command psql.exe -ErrorAction SilentlyContinue
if (-not $psql) {throw 'psql.exe not found. Install PostgreSQL client and put its bin directory in PATH.'}
if (-not $env:PG_LOCAL_PASSWORD) { throw 'PG_LOCAL_PASSWORD missing in root .env' }
$env:PGPASSWORD = $env:PG_LOCAL_PASSWORD
$superuser=$env:PG_LOCAL_SUPERUSER; if (-not $superuser) { $superuser='postgres' }
$args=@('-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','5432','-U',$superuser,'-d','postgres')
foreach($role in @('identity','content','assessment','arena','learning','media','ai_import','notification')) {
  $variable='PG_'+$role.ToUpper()+'_PASSWORD'
  $val=[Environment]::GetEnvironmentVariable($variable,'Process')
  if (-not $val) {throw "$variable missing in root .env"}
  $args += @('-v',"${role}_password=$val")
}
$args += @('-f',(Join-Path $root 'database/postgres/01-init.sql'))
& $psql.Source @args
if ($LASTEXITCODE -ne 0) {throw "PostgreSQL SQL initialization failed (exit $LASTEXITCODE)"}
Write-Host 'PostgreSQL: 8 databases created from 01-init.sql.'
