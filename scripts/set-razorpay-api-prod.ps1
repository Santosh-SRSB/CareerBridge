# Bind Razorpay env on careerbridge-api-prod. Keeps EMPLOYER_SUBSCRIPTIONS_LIVE=false
# so live employers stay on legacy free access until you explicitly turn the flag on.
# Usage:
#   $env:RAZORPAY_KEY_ID = "rzp_live_..."
#   $env:RAZORPAY_KEY_SECRET = "..."
#   $env:RAZORPAY_WEBHOOK_SECRET = "..."   # optional
#   .\scripts\set-razorpay-api-prod.ps1

$ErrorActionPreference = "Stop"
$Project = "careerbridgeprod"
$Region = "asia-south1"
$Service = "careerbridge-api-prod"

$keyId = ($env:RAZORPAY_KEY_ID -as [string]).Trim()
$secret = ($env:RAZORPAY_KEY_SECRET -as [string]).Trim()
$mode = (($env:RAZORPAY_MODE -as [string]).Trim().ToLower())
if (-not $mode) { $mode = "live" }
$webhook = ($env:RAZORPAY_WEBHOOK_SECRET -as [string]).Trim()

if (-not $keyId -or -not $secret) {
  Write-Error "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment, then re-run."
}

Write-Host "Updating $Service with RAZORPAY_MODE=$mode (key id only: $keyId); LIVE flag stays false"

$envPairs = @(
  "RAZORPAY_MODE=$mode",
  "RAZORPAY_KEY_ID=$keyId",
  "RAZORPAY_KEY_SECRET=$secret",
  "EMPLOYER_SUBSCRIPTIONS_LIVE=false"
)
if ($webhook) {
  $envPairs += "RAZORPAY_WEBHOOK_SECRET=$webhook"
}

$joined = ($envPairs -join ",")
gcloud run services update $Service `
  --project=$Project `
  --region=$Region `
  "--update-env-vars=$joined"

Write-Host "Done. Webhook URL: https://careerbridge-api-prod-koxxkmvxkq-el.a.run.app/api/v1/billing/webhooks/razorpay"
Write-Host "Add https://www.srsbcareerbridge.com in Razorpay Website allowlist."
