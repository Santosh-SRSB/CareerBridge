# Deploy CareerBridge API (NestJS) to Cloud Run — DEV
# Prerequisites: gcloud auth, Docker, Artifact Registry repo careerbridge-dev
#
# Usage (PowerShell, from repo root):
#   .\scripts\deploy-api-dev.ps1
#   .\scripts\deploy-api-dev.ps1 -Tag "0e684fd"
#
# Does NOT change DNS or www.srsbcareerbridge.com.

param(
  [string]$ProjectId = "careerbridge-f7b72",
  [string]$Region = "asia-south1",
  [string]$Repo = "careerbridge-dev",
  [string]$Service = "careerbridge-api-dev",
  [string]$CloudSqlInstance = "careerbridge-f7b72:asia-south1:careerbridge-dev-db",
  [string]$DbName = "careerbridge_dev",
  [string]$DbUser = "careerbridge_app",
  [string]$DbPasswordSecret = "careerbridge-db-password",
  [string]$Tag = ""
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not $Tag) {
  $Tag = (git rev-parse --short HEAD).Trim()
}

$Image = "$Region-docker.pkg.dev/$ProjectId/$Repo/api:$Tag"
$ImageLatest = "$Region-docker.pkg.dev/$ProjectId/$Repo/api:dev"

Write-Host "==> Project: $ProjectId"
Write-Host "==> Image:   $Image"

gcloud config set project $ProjectId | Out-Null

Write-Host "==> Ensure Artifact Registry repo exists"
gcloud artifacts repositories describe $Repo --location=$Region 2>$null
if ($LASTEXITCODE -ne 0) {
  gcloud artifacts repositories create $Repo `
    --repository-format=docker `
    --location=$Region `
    --description="CareerBridge DEV images"
}

Write-Host "==> Configure Docker auth for Artifact Registry"
gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet

Write-Host "==> Build API image"
docker build -f infrastructure/docker/Dockerfile.api -t $Image -t $ImageLatest .

Write-Host "==> Push images"
docker push $Image
docker push $ImageLatest

# DATABASE_URL uses Cloud SQL Auth Proxy socket. Password from Secret Manager.
# Cloud Run substitutes secrets; we assemble DATABASE_URL from parts via env if needed.
# Prefer a full DATABASE_URL secret later; for now inject password secret as DB_PASSWORD.

Write-Host "==> Deploy Cloud Run service $Service"
gcloud run deploy $Service `
  --image=$Image `
  --region=$Region `
  --platform=managed `
  --allow-unauthenticated `
  --port=8080 `
  --memory=1Gi `
  --cpu=1 `
  --min-instances=0 `
  --max-instances=5 `
  --timeout=300 `
  --add-cloudsql-instances=$CloudSqlInstance `
  --set-secrets="DB_PASSWORD=$DbPasswordSecret:latest" `
  --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=$ProjectId,GCS_BUCKET=srsbbucket,GCP_REGION=$Region,WEB_ORIGIN=http://localhost:3000,https://www.srsbcareerbridge.com,AUTH_DEV_OTP=false,FIREBASE_PROJECT_ID=$ProjectId,DATABASE_USER=$DbUser,DATABASE_NAME=$DbName,DATABASE_HOST=/cloudsql/$CloudSqlInstance"

Write-Host ""
Write-Host "NOTE: Prisma needs DATABASE_URL. After first deploy, set:"
Write-Host '  postgresql://careerbridge_app:${DB_PASSWORD}@localhost/careerbridge_dev?host=/cloudsql/careerbridge-f7b72:asia-south1:careerbridge-dev-db'
Write-Host "Create a Secret Manager secret 'careerbridge-database-url' with the full URL (password included),"
Write-Host "then: gcloud run services update $Service --region=$Region --set-secrets=DATABASE_URL=careerbridge-database-url:latest"
Write-Host ""
Write-Host "Service URL:"
gcloud run services describe $Service --region=$Region --format='value(status.url)'
Write-Host "Health: <URL>/health"
Write-Host "API:    <URL>/api/v1"
Write-Host "Done. Do NOT change DNS yet."
