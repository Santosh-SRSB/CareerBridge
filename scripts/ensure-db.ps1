# Ensure local Postgres (docker compose) is up before API/web start.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$compose = Join-Path $root 'docker-compose.yml'
if (-not (Test-Path $compose)) {
  Write-Host 'No docker-compose.yml; skipping db:ensure.'
  exit 0
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Host 'Docker not found; skipping db:ensure (use an existing Postgres).'
  exit 0
}

try {
  docker compose up -d postgres 2>&1 | Out-Host
} catch {
  Write-Host "Could not start postgres via docker compose: $_"
  Write-Host 'Continuing; API will fail if DATABASE_URL is unreachable.'
  exit 0
}

# Brief wait so the API does not race a cold container
Start-Sleep -Seconds 2
Write-Host 'Postgres ensure step finished.'
