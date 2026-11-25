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

## Website allowlist (required for Live Checkout) — DO THIS FIRST

Live UPI/QR will show success in Paytm/GPay but Razorpay **blocks capture** until the checkout domain is registered:

Razorpay Dashboard → **Account & Settings** → **Website and app settings** → **Business website details** → add:

- `https://www.srsbcareerbridge.co.in` (primary — used by employers on DEV)
- `https://srsbcareerbridge.co.in` (apex, if it serves the app)
- Cloud Run web URL if you test checkout there

Submit for review (often minutes for checks, up to 24–48h for agent approval).

Without this, every live Checkout payment fails with:
`Payment blocked as website does not match registered website(s)`.

## Behaviour if keys are missing

API falls back to **mock** checkout so DEV is not blocked. Mock activates the subscription without real money. Set live/test keys for real Razorpay Checkout.
