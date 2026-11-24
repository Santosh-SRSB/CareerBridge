# Bind Razorpay env on careerbridge-api-dev (DEV / .co.in only). Does not touch prod.
# Usage (PowerShell, gcloud logged in):
#   $env:RAZORPAY_KEY_ID = "rzp_live_..."
#   $env:RAZORPAY_KEY_SECRET = "..."
#   .\scripts\set-razorpay-api-dev.ps1
# Optional: $env:RAZORPAY_MODE = "live"  (default live)
# Optional: $env:RAZORPAY_WEBHOOK_SECRET = "..."

$ErrorActionPreference = "Stop"
$Project = "careerbridge-f7b72"
$Region = "asia-south1"
$Service = "careerbridge-api-dev"

$keyId = ($env:RAZORPAY_KEY_ID -as [string]).Trim()
$secret = ($env:RAZORPAY_KEY_SECRET -as [string]).Trim()
$mode = (($env:RAZORPAY_MODE -as [string]).Trim().ToLower())
if (-not $mode) { $mode = "live" }
$webhook = ($env:RAZORPAY_WEBHOOK_SECRET -as [string]).Trim()

if (-not $keyId -or -not $secret) {
  Write-Error "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment, then re-run."
}

Write-Host "Updating $Service with RAZORPAY_MODE=$mode (key id only logged: $keyId)"

$envPairs = @(
  "RAZORPAY_MODE=$mode",
  "RAZORPAY_KEY_ID=$keyId",
  "RAZORPAY_KEY_SECRET=$secret"
)
if ($webhook) {
  $envPairs += "RAZORPAY_WEBHOOK_SECRET=$webhook"
}

# Quote as one arg so PowerShell does not split on commas / @ in secrets.
$joined = ($envPairs -join ",")
gcloud run services update $Service `
  --project=$Project `
  --region=$Region `
  "--update-env-vars=$joined"

Write-Host "Done. Also add https://srsbcareerbridge.co.in (and www) under Razorpay → Settings → Website & app."
