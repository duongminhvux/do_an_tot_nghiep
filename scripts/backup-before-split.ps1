param([string]$DbName='english-platform', [string]$Bucket='vocalearn-media')
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
Write-Host 'Step 1/2: MongoDB backup'
& (Join-Path $PSScriptRoot 'backup-mongo.ps1') -DbName $DbName
if ($LASTEXITCODE -ne 0) { throw 'MongoDB backup failed' }
Write-Host 'Step 2/2: MinIO/S3 media backup (Python + boto3 required)'
$env:S3_BUCKET=$Bucket
& python (Join-Path $PSScriptRoot 's3-backup-restore.py') backup --env-file .env --out backups/media
if ($LASTEXITCODE -ne 0) { throw 'Media backup failed' }
Write-Host 'Backups completed. Verify archives before running migrations.'
