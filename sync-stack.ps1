$ErrorActionPreference = "Stop"

# ============================================================
# MONOREPO STACK SYNC - SAFE VERSION
# ============================================================

$NEXT_VERSION = "16.3.5"
$REACT_VERSION = "19.3.0"
$TYPESCRIPT_VERSION = "7.0.2"
$ESLINT_VERSION = "10.10.0"

$ROOT = Get-Location

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "       MONOREPO STACK SYNC - SAFE" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Target versions:" -ForegroundColor Yellow
Write-Host "  Next.js     $NEXT_VERSION"
Write-Host "  React       $REACT_VERSION"
Write-Host "  TypeScript  $TYPESCRIPT_VERSION"
Write-Host "  ESLint      $ESLINT_VERSION"
Write-Host ""

# ============================================================
# CHECK ROOT
# ============================================================

if (!(Test-Path "package.json")) {
    throw "package.json not found. Run this script from repository root."
}

if (!(Test-Path "pnpm-workspace.yaml")) {
    throw "pnpm-workspace.yaml not found."
}

# ============================================================
# JSON HELPERS
# ============================================================

function Load-Json {
    param([string]$Path)

    return Get-Content $Path -Raw | ConvertFrom-Json
}

function Save-Json {
    param(
        [string]$Path,
        $Object
    )

    $Object |
        ConvertTo-Json -Depth 100 |
        Set-Content $Path -Encoding UTF8
}

function Set-Dependency {
    param(
        $Json,
        [string]$Section,
        [string]$Name,
        [string]$Version
    )

    if ($null -eq $Json.$Section) {
        $Json | Add-Member `
            -MemberType NoteProperty `
            -Name $Section `
            -Value ([pscustomobject]@{})
    }

    $Json.$Section |
        Add-Member `
            -MemberType NoteProperty `
            -Name $Name `
            -Value $Version `
            -Force
}

function Remove-Dependency {
    param(
        $Json,
        [string]$Section,
        [string]$Name
    )

    if ($null -ne $Json.$Section) {
        $property = $Json.$Section.PSObject.Properties[$Name]

        if ($null -ne $property) {
            $Json.$Section.PSObject.Properties.Remove($Name)

            Write-Host "  Removed $Name from $Section" -ForegroundColor Green
        }
    }
}

# ============================================================
# WEB
# ============================================================

Write-Host "[1/7] Syncing apps/web..." -ForegroundColor Cyan

$path = "apps/web/package.json"

if (Test-Path $path) {

    $json = Load-Json $path

    Set-Dependency $json "dependencies" "next" $NEXT_VERSION
    Set-Dependency $json "dependencies" "react" $REACT_VERSION
    Set-Dependency $json "dependencies" "react-dom" $REACT_VERSION

    Set-Dependency $json "devDependencies" "typescript" $TYPESCRIPT_VERSION
    Set-Dependency $json "devDependencies" "eslint" $ESLINT_VERSION

    Set-Dependency $json "devDependencies" "@types/react" $REACT_VERSION
    Set-Dependency $json "devDependencies" "@types/react-dom" $REACT_VERSION

    Save-Json $path $json

    Write-Host "  OK apps/web/package.json" -ForegroundColor Green
}

# ============================================================
# ADMIN
# ============================================================

Write-Host "[2/7] Syncing apps/admin-web..." -ForegroundColor Cyan

$path = "apps/admin-web/package.json"

if (Test-Path $path) {

    $json = Load-Json $path

    Set-Dependency $json "dependencies" "next" $NEXT_VERSION
    Set-Dependency $json "dependencies" "react" $REACT_VERSION
    Set-Dependency $json "dependencies" "react-dom" $REACT_VERSION

    Set-Dependency $json "devDependencies" "typescript" $TYPESCRIPT_VERSION
    Set-Dependency $json "devDependencies" "eslint" $ESLINT_VERSION
    Set-Dependency $json "devDependencies" "eslint-config-next" $NEXT_VERSION

    Set-Dependency $json "devDependencies" "@types/react" $REACT_VERSION
    Set-Dependency $json "devDependencies" "@types/react-dom" $REACT_VERSION

    Save-Json $path $json

    Write-Host "  OK apps/admin-web/package.json" -ForegroundColor Green
}

# ============================================================
# API
# ============================================================

Write-Host "[3/7] Syncing apps/api..." -ForegroundColor Cyan

$path = "apps/api/package.json"

if (Test-Path $path) {

    $json = Load-Json $path

    Set-Dependency $json "devDependencies" "typescript" $TYPESCRIPT_VERSION
    Set-Dependency $json "devDependencies" "eslint" $ESLINT_VERSION

    Save-Json $path $json

    Write-Host "  OK apps/api/package.json" -ForegroundColor Green
}

# ============================================================
# SHARED TYPES
# ============================================================

Write-Host "[4/7] Fixing packages/shared-types..." -ForegroundColor Cyan

$path = "packages/shared-types/package.json"

if (Test-Path $path) {

    $json = Load-Json $path

    # IMPORTANT:
    # Remove package depending on itself
    Remove-Dependency $json "devDependencies" "@repo/shared-types"

    Set-Dependency $json "devDependencies" "typescript" $TYPESCRIPT_VERSION

    Save-Json $path $json

    Write-Host "  OK packages/shared-types/package.json" -ForegroundColor Green
}

# ============================================================
# ESLINT CONFIG
# ============================================================

Write-Host "[5/7] Syncing packages/eslint-config..." -ForegroundColor Cyan

$path = "packages/eslint-config/package.json"

if (Test-Path $path) {

    $json = Load-Json $path

    Set-Dependency $json "devDependencies" "eslint" $ESLINT_VERSION
    Set-Dependency $json "devDependencies" "@next/eslint-plugin-next" $NEXT_VERSION

    Save-Json $path $json

    Write-Host "  OK packages/eslint-config/package.json" -ForegroundColor Green
}

# ============================================================
# ADMIN TSCONFIG
# ============================================================

Write-Host "[6/7] Syncing TypeScript configs..." -ForegroundColor Cyan

$adminTsConfig = @'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "plugins": [
      {
        "name": "next"
      }
    ],
    "strictNullChecks": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    "next-env.d.ts",
    "next.config.ts",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": [
    "node_modules"
  ]
}
'@

Set-Content `
    "apps/admin-web/tsconfig.json" `
    $adminTsConfig `
    -Encoding UTF8

Write-Host "  OK apps/admin-web/tsconfig.json" -ForegroundColor Green

# ============================================================
# WEB TSCONFIG
# ============================================================

$webTsConfig = @'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "plugins": [
      {
        "name": "next"
      }
    ],
    "strictNullChecks": true
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    "next-env.d.ts",
    "next.config.js",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
'@

Set-Content `
    "apps/web/tsconfig.json" `
    $webTsConfig `
    -Encoding UTF8

Write-Host "  OK apps/web/tsconfig.json" -ForegroundColor Green

# ============================================================
# DO NOT DELETE LOCKFILE
# ============================================================

Write-Host ""
Write-Host "==============================================" -ForegroundColor DarkCyan
Write-Host "Dependency installation" -ForegroundColor DarkCyan
Write-Host "==============================================" -ForegroundColor DarkCyan
Write-Host ""

Write-Host "IMPORTANT:" -ForegroundColor Yellow
Write-Host "  Existing pnpm-lock.yaml will NOT be deleted."
Write-Host "  Existing node_modules will NOT be deleted."
Write-Host ""

# ============================================================
# INSTALL
# ============================================================

Write-Host "Running pnpm install..." -ForegroundColor Cyan
Write-Host ""

pnpm install

if ($LASTEXITCODE -ne 0) {

    Write-Host ""
    Write-Host "==============================================" -ForegroundColor Red
    Write-Host "pnpm install FAILED" -ForegroundColor Red
    Write-Host "==============================================" -ForegroundColor Red
    Write-Host ""

    Write-Host "If you see ERR_PNPM_IGNORED_BUILDS:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "    pnpm approve-builds" -ForegroundColor White
    Write-Host ""
    Write-Host "Approve ONLY the package(s) you trust,"
    Write-Host "then run this script again."
    Write-Host ""

    exit 1
}

# ============================================================
# PEER CHECK
# ============================================================

Write-Host ""
Write-Host "[7/7] Checking peer dependencies..." -ForegroundColor Cyan
Write-Host ""

pnpm peers check

$peerExitCode = $LASTEXITCODE

if ($peerExitCode -ne 0) {

    Write-Host ""
    Write-Host "WARNING: Peer dependency problems detected." -ForegroundColor Yellow
    Write-Host "The installation itself succeeded." -ForegroundColor Yellow
    Write-Host ""
}

# ============================================================
# VERSION CHECK
# ============================================================

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Installed versions" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "TypeScript:" -ForegroundColor Yellow
pnpm exec tsc --version

Write-Host ""
Write-Host "Web Next.js:" -ForegroundColor Yellow
pnpm --filter web exec next --version

Write-Host ""
Write-Host "Admin Next.js:" -ForegroundColor Yellow
pnpm --filter admin_web exec next --version

# ============================================================
# TYPE CHECK
# ============================================================

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Type checking" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

pnpm check-types

if ($LASTEXITCODE -ne 0) {

    Write-Host ""
    Write-Host "TYPE CHECK FAILED." -ForegroundColor Red
    Write-Host "Fix type errors before continuing." -ForegroundColor Yellow
    exit 1
}

# ============================================================
# LINT
# ============================================================

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Lint" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

pnpm lint

if ($LASTEXITCODE -ne 0) {

    Write-Host ""
    Write-Host "LINT FAILED." -ForegroundColor Red
    Write-Host "Fix lint errors before continuing." -ForegroundColor Yellow
    exit 1
}

# ============================================================
# BUILD
# ============================================================

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Build" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

pnpm build

if ($LASTEXITCODE -ne 0) {

    Write-Host ""
    Write-Host "BUILD FAILED." -ForegroundColor Red
    Write-Host "Check the build error above." -ForegroundColor Yellow
    exit 1
}

# ============================================================
# SUCCESS
# ============================================================

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "       STACK SYNC SUCCESSFUL" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""

Write-Host "Everything passed:" -ForegroundColor Green
Write-Host "  [OK] package versions synced"
Write-Host "  [OK] self dependency removed"
Write-Host "  [OK] TypeScript configs synced"
Write-Host "  [OK] pnpm install"
Write-Host "  [OK] peer dependency check"
Write-Host "  [OK] type check"
Write-Host "  [OK] lint"
Write-Host "  [OK] build"
Write-Host ""