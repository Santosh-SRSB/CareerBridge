# GSTIN verification — Production setup (IRIS IRP)

Use this checklist **after** sandbox integration is complete.

Official references:

- [Applying for production access](https://einvoice6.gst.gov.in/content/kb/applying-for-production-access/)
- [API credentials](https://einvoice6.gst.gov.in/content/kb/api-credentials/)
- [Authentication](https://einvoice6.gst.gov.in/content/kb/authentication/)

## Before production

- [ ] Sandbox integration completed against real IRIS sandbox credentials
- [ ] Sandbox test cases completed (active / inactive / invalid / timeout / rate limit)
- [ ] Test report prepared for IRIS onboarding
- [ ] Production application submitted on IRIS portal
- [ ] KYC / SPOC documents submitted as required by IRIS
- [ ] Privacy Policy and Terms of Use available
- [ ] Production static **Indian IP** identified for whitelisting
- [ ] Production credentials received (Portal ID, Client ID, Client Secret, username/password, public key, base URL)
- [ ] Credentials stored only in secure server env (never in git / frontend)
- [ ] Confirm Auth + Get GSTIN paths against current Core APIs wiki
- [ ] Confirm whether your production approval allows verifying employer-entered GSTINs (taxpayer authorisation / onboarding scope)
- [ ] `GST_ENV=production` set
- [ ] Production smoke test completed

## Environment switch

Same code path as sandbox. Only configuration changes:

```env
GST_ENV=production

GST_PRODUCTION_BASE_URL=<REAL_PRODUCTION_URL>
GST_PRODUCTION_PORTAL_ID=<REAL_PORTAL_ID>
GST_PRODUCTION_CLIENT_ID=<REAL_CLIENT_ID>
GST_PRODUCTION_CLIENT_SECRET=<REAL_CLIENT_SECRET>
GST_PRODUCTION_USERNAME=<REAL_USERNAME>
GST_PRODUCTION_PASSWORD=<REAL_PASSWORD>
GST_PRODUCTION_REQUESTER_GSTIN=<AUTHORISED_GSTIN>

GST_PUBLIC_KEY_PEM=<production public key if different>
GST_MOCK_ENABLED=false
```

If production credentials are missing or still placeholders, the API **refuses to start**.

## Scope / authorisation warning

Do **not** scrape the GST portal or bypass CAPTCHA.

If IRIS production access only allows Get GSTIN Details for authorised taxpayers, document that product limitation and keep using the `IrisIrpGstProvider` abstraction until an approved verification channel is available.

## Smoke test

1. `GET /api/v1/gst/health` → `environment: production`, `configured: true`
2. Verify one known active GSTIN (authorised scope)
3. Verify one known non-active GSTIN
4. Confirm frontend shows only Verified / Failed / Unable messages (no raw IRIS payload)
