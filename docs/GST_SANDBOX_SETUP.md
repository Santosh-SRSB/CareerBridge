# GSTIN verification — Sandbox setup (IRIS IRP)

This guide configures CareerBridge to call the official **IRIS IRP** Core API **Get GSTIN Details** in **sandbox** mode.

Official references:

- [Core APIs wiki](https://einvoice6.gst.gov.in/content/core-apis-wiki/)
- [API integration](https://einvoice6.gst.gov.in/content/api-integration/)
- [API credentials](https://einvoice6.gst.gov.in/content/kb/api-credentials/)
- [Authentication](https://einvoice6.gst.gov.in/content/kb/authentication/)
- [Access to sandbox](https://einvoice6.gst.gov.in/content/kb/access-to-sandbox/)
- [Get GSTIN Details](https://einvoice6.gst.gov.in/content/kb/get-gstin-details/)

## Important limitation

IRIS documents that **core e-invoice APIs can be called for a taxpayer only if the API user is authorised by that taxpayer** (Manage API access / onboarding).

That means production credentials may **not** allow verifying every arbitrary GSTIN entered by every employer unless your IRIS onboarding/approval covers that use case.

CareerBridge isolates IRIS-specific logic in `apps/api/src/gst/gst.provider.ts` so another officially supported verification provider can be swapped later without changing the KYC UI.

## 1. Register as API integrator

1. Open the IRIS IRP portal and complete **API Developer / Integrator** registration.
2. Request **sandbox** access ([sandbox access guide](https://einvoice6.gst.gov.in/content/kb/access-to-sandbox/)).
3. Receive credentials (per [API credentials](https://einvoice6.gst.gov.in/content/kb/api-credentials/)):

| Credential | Used for |
|---|---|
| Sandbox Portal ID | Portal / VAS APIs (stored for completeness) |
| Sandbox Client ID + Client Secret | Core e-invoice API calls |
| Sandbox IRP username / password | Authentication API |
| Public key | RSA encryption of password / AppKey |
| Sandbox base URL | Provided with your sandbox pack |

Confirm exact Auth and Get GSTIN **paths** in the Core APIs wiki after login — do not invent endpoints.

## 2. Configure environment

Copy placeholders from the root `.env.example` into `apps/api/.env`:

```env
GST_ENV=sandbox

GST_SANDBOX_BASE_URL=<URL from IRIS sandbox pack>
GST_SANDBOX_PORTAL_ID=<sandbox portal id>
GST_SANDBOX_CLIENT_ID=<sandbox client id>
GST_SANDBOX_CLIENT_SECRET=<sandbox client secret>
GST_SANDBOX_USERNAME=<irp username>
GST_SANDBOX_PASSWORD=<irp password>
GST_SANDBOX_REQUESTER_GSTIN=<GSTIN authorised for API access>

GST_AUTH_PATH=/eivital/v1.04/auth
GST_GET_GSTIN_PATH=/eivital/v1.04/Master/gstin/{gstin}

GST_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

GST_API_TIMEOUT_MS=15000
GST_API_MAX_RETRIES=2
GST_MOCK_ENABLED=false
```

Path defaults follow the public NIC e-invoice surface that IRIS describes as compatible with the E-invoice standard. **Override them** if your official wiki shows different paths/versions.

Never commit real secrets. `.env` is gitignored.

## 3. Local UI testing without credentials

Until sandbox credentials arrive:

```env
GST_ENV=sandbox
GST_MOCK_ENABLED=true
GST_MOCK_ACTIVE_GSTIN=29AAAAA0000A1Z5
GST_MOCK_INACTIVE_GSTIN=29BBBBB0000B1Z5
```

Mock mode is clearly logged and **never** used when live credentials are configured (`configured=true`).

## 4. Run backend

```bash
npm.cmd run prisma:push -w api
npm.cmd run start:dev -w api
```

Health (authenticated employer):

```http
GET /api/v1/gst/health
```

Expected shape:

```json
{
  "configured": true,
  "environment": "sandbox",
  "provider": "IRIS_IRP",
  "mockEnabled": false
}
```

## 5. Test verification

1. Sign in as an employer.
2. Open `/employer/kyc`.
3. Enter GSTIN → **Verify GSTIN**.
4. Expect:
   - Active → `✅ GSTIN Verified Successfully`
   - Non-active → `❌ GSTIN Verification Failed`
   - API/config failure → `⚠️ Unable to verify GSTIN right now`

Unit tests (no live API):

```bash
npm.cmd run test:gst -w api
```

Sandbox integration (requires API up + bearer token + test GSTINs):

```bash
set GST_RUN_INTEGRATION=true
set GST_INTEGRATION_BEARER_TOKEN=<employer jwt>
set GST_TEST_ACTIVE_GSTIN=<sandbox gstin>
npm.cmd run test:gst:integration -w api
```

## 6. Safe logging

Backend logs masked GSTINs (`29ABCDE******Z5`), environment, duration, and HTTP status codes.

Never log Client Secret, AuthToken, Portal ID, passwords, or full provider payloads.

## 7. Switch to production later

See `docs/GST_PRODUCTION_SETUP.md`. Only change env vars (`GST_ENV=production` + production credentials). No code fork.
