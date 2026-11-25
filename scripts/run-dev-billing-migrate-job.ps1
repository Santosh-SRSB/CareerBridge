# DEV only: one-off Cloud Run Job to resolve blocked Prisma history + apply additive billing migrations.
# Does not touch prod. Uses existing API image + DEV Cloud SQL + runtime SA.
$ErrorActionPreference = "Stop"
$gcloud = "C:\Users\SRSB HR SOLUTIONS\google-cloud-sdk\bin\gcloud.cmd"
$Project = "careerbridge-f7b72"
$Region = "asia-south1"
$Job = "careerbridge-dev-billing-migrate"
$Image = "asia-south1-docker.pkg.dev/careerbridge-f7b72/careerbridge-dev/api:cde5fc3277dd6c41d16db185bdb743a0df1a7867"
$SA = "careerbridge-api-runtime-dev@careerbridge-f7b72.iam.gserviceaccount.com"
$CloudSql = "careerbridge-f7b72:asia-south1:careerbridge-dev-db"

# Shell script inside the container (same DATABASE_URL build as docker-entrypoint).
$inner = @'
set -eu
PASS=$(printf '%s' "$DB_PASSWORD" | sed -e 's/%/%25/g' -e 's/@/%40/g' -e 's/:/%3A/g' -e 's|/|%2F|g' -e 's/#/%23/g' -e 's/?/%3F/g' -e 's/&/%26/g' -e 's/+/%2B/g' -e 's/ /%20/g')
export DATABASE_URL="postgresql://${DATABASE_USER}:${PASS}@localhost/${DATABASE_NAME}?host=${DATABASE_HOST}&schema=public"
echo "job: resolving failed referral migration if present…"
npx --yes prisma@6 migrate resolve --applied "20261103180000_referral_earn" --schema=./prisma/schema.prisma || true
echo "job: prisma migrate deploy…"
npx --yes prisma@6 migrate deploy --schema=./prisma/schema.prisma
echo "job: verifying employer_payments.plan_id…"
node -e "const {PrismaClient}=require('./generated/prisma'); const p=new PrismaClient(); p.\$queryRawUnsafe(\"SELECT column_name FROM information_schema.columns WHERE table_name='employer_payments' AND column_name='plan_id'\").then(r=>{console.log('plan_id_columns', r.length); if(!r.length) process.exit(2);}).finally(()=>p.\$disconnect())"
'@

# Write inner script to a temp file for reference / debugging (not uploaded; passed via --args).
$innerPath = Join-Path $env:TEMP "cb-dev-billing-migrate-inner.sh"
Set-Content -Path $innerPath -Value $inner -Encoding ascii

Write-Host "Deploying DEV-only job $Job …"
& $gcloud run jobs delete $Job --project=$Project --region=$Region --quiet 2>$null | Out-Null

& $gcloud run jobs deploy $Job `
  --project=$Project `
  --region=$Region `
  --image=$Image `
  --service-account=$SA `
  --set-cloudsql-instances=$CloudSql `
  --set-secrets="DB_PASSWORD=careerbridge-db-password:latest" `
  --set-env-vars="DATABASE_USER=careerbridge_app,DATABASE_NAME=careerbridge_dev,DATABASE_HOST=/cloudsql/careerbridge-f7b72:asia-south1:careerbridge-dev-db" `
  --command=/bin/sh `
  --args="-c=$inner" `
  --max-retries=0 `
  --task-timeout=15m `
  --memory=1Gi `
  --cpu=1 `
  --quiet

Write-Host "Executing job…"
& $gcloud run jobs execute $Job --project=$Project --region=$Region --wait
Write-Host "Done."
