# Razorpay webhook + keys on DEV (.co.in)

## Webhook URL (register in Razorpay Dashboard → Webhooks)

```
https://careerbridge-api-dev-yo5h6bqrha-el.a.run.app/api/v1/billing/webhooks/razorpay
```

Also add the **Active** Cloud Run API URL if it differs (check Cloud Run → careerbridge-api-dev → URL).

### Events to enable
- `payment.captured`

### Secret
1. Create webhook → copy **Webhook secret**
2. Set on `careerbridge-api-dev`:
   - `RAZORPAY_WEBHOOK_SECRET=<secret>`
   - `RAZORPAY_MODE=live` (or `test`)
   - `RAZORPAY_KEY_ID=...`
   - `RAZORPAY_KEY_SECRET=...`

Script (local machine with gcloud auth):

```powershell
$env:RAZORPAY_KEY_ID = "rzp_..."
$env:RAZORPAY_KEY_SECRET = "..."
$env:RAZORPAY_MODE = "live"
$env:RAZORPAY_WEBHOOK_SECRET = "whsec_..."
.\scripts\set-razorpay-api-dev.ps1
```

## Website allowlist (required for Live Checkout)

Razorpay → Settings → Website and app → add:

- `https://www.srsbcareerbridge.co.in`
- `https://srsbcareerbridge.co.in` (after DNS points to the app — currently parking)
- Cloud Run web URL if testing there

Without this, UPI/live payments fail with “website does not match registered website(s)”.

## Behaviour if keys are missing

API falls back to **mock** checkout so DEV is not blocked. Mock activates the subscription without real money. Set live/test keys for real Razorpay Checkout.
