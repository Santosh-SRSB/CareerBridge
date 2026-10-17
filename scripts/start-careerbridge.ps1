# CareerBridge — start the full local system (Windows PowerShell)
#
# Usage (from repo root):
#   .\scripts\start-careerbridge.ps1
#
# Optional:
#   .\scripts\start-careerbridge.ps1 -SkipDocker
#   .\scripts\start-careerbridge.ps1 -SkipInstall

param(
  [switch]$SkipDocker,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ""
Write-Host "=== CareerBridge local start ===" -ForegroundColor Cyan
Write-Host "Repo: $Root"
Write-Host ""

function Stop-PortListeners([int[]]$Ports) {
  foreach ($port in $Ports) {   
    $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
      if ($procId) {
        Write-Host "Stopping process on port $port (PID $procId)..."
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      }
    }
  }
}

Write-Host "1) Stopping old Node / Nest / Next processes..."
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and ($_.CommandLine -match 'CareerBridge|concurrently|nest|next') } |
  ForEach-Object {
    Write-Host "  Kill PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
Start-Sleep -Seconds 2
Stop-PortListeners @(3000, 3001)
Start-Sleep -Seconds 1

if (-not $SkipDocker) {
  Write-Host ""
  Write-Host "2) Starting Postgres (docker compose)..."
  try {
    docker compose up -d 2>&1 | Select-Object -Last 12
  } catch {
    Write-Host "Docker compose failed (is Docker Desktop running?). Continuing without it..." -ForegroundColor Yellow
  }
} else {
  Write-Host "2) Skipping Docker (-SkipDocker)"
}

if (-not $SkipInstall) {
  Write-Host ""
  Write-Host "3) Ensuring dependencies (npm install)..."
  npm install 2>&1 | Select-Object -Last 8
} else {
  Write-Host "3) Skipping npm install (-SkipInstall)"
}

Write-Host ""
Write-Host "4) Building shared package..."
npm run build -w @careerbridge/shared 2>&1 | Select-Object -Last 10

Write-Host ""
Write-Host "5) Generating Prisma client..."
Push-Location (Join-Path $Root "apps\api")
try {
  npx prisma generate 2>&1 | Select-Object -Last 12
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "6) Starting API (3001) + Web (3000)..."
Write-Host "   Web: http://127.0.0.1:3000"
Write-Host "   API: http://localhost:3001/api/v1"
Write-Host "   Docs: http://localhost:3001/api/docs"
Write-Host ""
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow
Write-Host ""

npm run dev
