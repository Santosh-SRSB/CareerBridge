# CareerBridge security-readiness assessment

Assessment date: 2026-10-12, updated the same day after Phase 1 revalidation. Scope is the local `dev` working tree plus read-only production-dependency advisory data and a read-only Cloud Run image check. This is not a certification, not an OWASP ASVS attestation, and not a statement that CareerBridge DEV is secure.

Nothing in this assessment was committed, deployed, merged, or pushed. Live IAM, Cloud SQL grants, Secret Manager payloads, DNS, and production data were not changed. No WhatsApp message was sent. No migration was run.

## 1. Executive summary

The API authenticates with a global JWT guard, enforces roles on the controllers that declare them, validates request bodies with a whitelist pipe, and encrypts employer GSTIN/PAN/CIN with AES-256-GCM when the keyring is configured. WhatsApp webhooks verify HMAC when the app secret is present. DEV Terraform binds `RESUME_TASK_SECRET` and sets `WHATSAPP_REQUIRE_SIGNATURE=true`.

Confirmed code defects fixed locally, with regression tests:

- The public resume worker accepted calls whenever `RESUME_TASK_SECRET` was unset, including on Cloud Run.
- `GET /api/v1/platform/stats` skipped the global rate limit.
- The public resume-structuring endpoint had no body-size cap and only the global rate limit.
- API responses did not set baseline browser security headers, and Swagger was mounted in production.
- The web app did not set baseline security headers.

Phase 1 then upgraded the two production packages that the audit had marked critical, and closed the WhatsApp task callback the same way as the resume worker. After that, `npm audit --omit=dev` reports critical=0, high=12, moderate=16, low=1, total=29. `next` and `proxy-addr` are absent from that production audit. Twelve high advisories remain, including `multer` 2.0.2, which Nest pins exactly. Live cross-account authorization, Cloud SQL privileges, and effective IAM were not executed.

Section 16 records the Firebase/gRPC decision and the authentication design. Section 17 is the pre-deployment check. Section 18 is the DEV IAM plan and is not applied. Section 19 is the runtime-identity implementation plan. It supersedes the section 18 service-agent `serviceAccountUser` grant, the unresolved `storage.buckets.get` note, and the unproven instance and processor scopes. Earlier sections stay as the history of what was found.

The running DEV services do not contain these fixes. Read-only `gcloud run services describe` showed web revision `careerbridge-web-dev-00065-q6p` at 100% traffic on image `web:3228dd28117678720598259bd82dfc6f7c3f0a96`, and API revision `careerbridge-api-dev-00083-zhf` at 100% on image `api:567d544e5f6dab0cde3dce50e164d0edb7d6b8ca`. That API commit is current `origin/dev` and still has `next` `^16.3.1`, the WhatsApp task check `if (expected && secret !== expected)`, and the resume-worker check `if (expected && providedSecret !== expected)`.

Security-readiness for the assessed scope: **not met**. The critical production advisories are fixed only in this uncommitted working tree. High advisories remain. Live DEV was not retested with the fixed code.

## 2. What was inspected

- NestJS API under `apps/api` (controllers, global JWT guard, roles guard, throttler, Prisma raw SQL, PII crypto, WhatsApp signature helper, resume worker, human-mock join rules).
- Next.js app under `apps/web` (`next.config.ts`, `dangerouslySetInnerHTML` call sites, session storage).
- GitHub workflows `.github/workflows/ci.yml` and `deploy-dev.yml`.
- Dockerfiles `infrastructure/docker/Dockerfile.api` and `Dockerfile.web`.
- DEV Terraform references for `RESUME_TASK_SECRET` and `WHATSAPP_REQUIRE_SIGNATURE` in `infrastructure/terraform/environments/dev/cloud-run-env.tf`.
- Existing PII notes in `docs/pii-encryption-dev-runbook.md` and CI notes in `docs/ci-cd-dev.md`.

## 3. What was actually tested

| Check | Command / method | Result |
|---|---|---|
| Worker-auth and header regression tests | `node -r ts-node/register/transpile-only --test src/resumes/security-hardening.unit.test.ts` (cwd `apps/api`) | 7 passed, 0 failed, after the WhatsApp task case was added |
| Production dependency audit, before upgrades | `npm audit --omit=dev --json` (Node v24.19.0, npm 11.17.0) | critical=2, high=13, moderate=16, low=1, total=32 |
| Production dependency audit, after upgrades | same command | critical=0, high=12, moderate=16, low=1, total=29. `next` and `proxy-addr` absent. Exit 0 from the summary parser; npm itself still exits non-zero while highs remain |
| Full audit including devDependencies | `npm audit --json` | critical=`concurrently` 9.2.4 and `shell-quote` 1.9.0. Both are dev-only. Not in the API runtime image (`npm ci --omit=dev`) and not copied into the web runner stage |
| API unit suites | `npm run` of test:auth, test:email, test:whatsapp, test:whatsapp-flow, test:employer, test:admin, test:interview, test:pii, test:resume (cwd `apps/api`) | All selected suites passed. Resume suite: 86 tests, 84 passed, 2 skipped, 0 failed |
| Web unit tests | `node -r ts-node/register/transpile-only --test` on 23 `apps/web/src/**/*.unit.test.ts` from `apps/api` | 174 passed, 0 failed |
| Shared tests | `npm test -w @careerbridge/shared` | 75 passed, 0 failed |
| PII deploy preflight | `node --test .github/scripts/pii-deploy-preflight.test.mjs` | 14 passed, 0 failed |
| API production build | `npm run build -w api` | Exit 0 |
| Web typecheck | `npx next typegen` then `npx tsc --noEmit -p apps/web/tsconfig.json` | Exit 0. Build banner: Next.js 16.3.8 |
| Web production build | `npm run build -w web` | Exit 0. Compiled on Next.js 16.3.8 before the ESLint config install |
| Live image check | `gcloud run services describe` for `careerbridge-web-dev` and `careerbridge-api-dev`, project `careerbridge-f7b72`, region `asia-south1`, traffic and image only | Web 00065-q6p / `3228dd28…` at 100%. API 00083-zhf / `567d544…` at 100%. No config was changed |
| Source review of authz, public routes, raw SQL, webhook signature, PII format | Manual read | Findings in sections 5 and 6 |

Not run in this pass: gitleaks (binary absent; CI runs gitleaks 8.30.1 on the commits introduced by a change, not the whole history), Semgrep/CodeQL, container image scan, live IDOR suite, DAST, and Terraform plan.

## 4. Coverage matrix

| Area | Assets / boundary | Existing protection observed | Evidence | Status |
|---|---|---|---|---|
| Authentication | JWT bearer, OTP, password login, refresh | Global `JwtAuthGuard`; `@Public()` opt-out; login/OTP throttles; OTP capped at 5 per identifier per 15 minutes | `jwt-auth.guard.ts`, `auth.controller.ts`, `auth.service.ts` | PASS for the inspected controls. Live lockout/expiry NOT TESTED |
| Authorization | Candidate, employer, admin, super-admin controllers | `RolesGuard` on sensitive controllers. Guard allows the request when no roles are declared | Controller inventory in section 6 | PARTIAL. Source review only. Live role matrix NOT TESTED |
| Tenant isolation | Candidate and employer records | Services generally scope by `user.id` / candidate id. RAG search unit tests refuse a search without candidate and resume ids | `rag-retrieval.unit.test.ts` (existing). Live cross-account calls NOT TESTED | NOT TESTED against a running API |
| Resume worker | `POST /api/v1/resumes/worker/process` | Secret check, and resume must belong to `userId`. Previously fail-open if the secret was empty | `resume-worker-auth.ts` tests | FAIL before fix. Local fix PASS |
| Public AI parse | `POST /api/v1/resumes/structure-text` | Was public with only the global limiter and no max length | Controller diff | FAIL before fix. Local limit and throttle added. Live abuse NOT TESTED |
| Platform stats | `GET /api/v1/platform/stats` | Public aggregate counts. Class-level `@SkipThrottle()` | `platform.controller.ts` | FAIL before fix. Local throttle restored |
| WhatsApp webhook | Meta callback | HMAC required when app secret is set; DEV Terraform sets `WHATSAPP_REQUIRE_SIGNATURE=true` | Existing `whatsapp.lifecycle.unit.test.ts`. Live webhook NOT TESTED and no message sent | PASS for the reviewed helper. Live config NOT TESTED |
| WhatsApp task callback | `POST /api/v1/whatsapp/tasks/run` | Was fail-open when `WHATSAPP_TASK_SECRET` was empty. `origin/dev` still is | `task-secret.ts` and the controller diff | FAIL on the deployed commit. Local fix PASS in unit tests. Not invoked |
| PII at rest | GSTIN, PAN, CIN | AES-256-GCM, AAD bound to column and key id, separate HMAC lookup key. Deploy preflight checks the DEV keyring binding by name | `pii-crypto.ts`, `deploy-dev.yml` | PASS for the algorithm in source. Live ciphertext and key ACL NOT TESTED. Keys were not read |
| SQL | Nearby jobs, embeddings | Nearby jobs use `Prisma.sql` parameters. Embedding SQL uses `$1` placeholders. Vector literal rejects non-finite numbers | `jobs.service.ts`, `vector-store.service.ts` | PASS on inspection. No exploit executed |
| XSS | Web rendering | `dangerouslySetInnerHTML` sites reviewed are static CSS, not user HTML | `resume/page.tsx` and resume form components | PASS for those call sites. Full DOM XSS NOT TESTED |
| Sessions | Browser | Access token in `localStorage` (`cb_access_token`), not an HttpOnly cookie | `apps/web/src/lib/session.ts` | Residual risk. See findings |
| Security headers | API and web | Were absent | `main.ts`, `next.config.ts` | FAIL before fix. Local headers added. Deployed responses NOT TESTED |
| Dependencies | Production lockfile | CI audit is report-only | `npm audit --omit=dev` after the upgrades | PARTIAL. Critical `next` and `proxy-addr` cleared locally. 12 highs remain. Live images unchanged |
| CI/CD | GitHub Actions | `permissions: contents: read` at workflow level; deploy jobs add `id-token: write`. No `pull_request_target`. PII preflight before deploy | `ci.yml`, `deploy-dev.yml` | PASS for declared workflow permissions. Branch protection and effective GCP IAM NOT TESTED |
| Containers | API and web images | Web image sets `USER nextjs`. API image does not set `USER` | Dockerfiles | API non-root: FAIL (not changed). Web: PASS on inspection |
| Cloud runtime | Cloud Run, Cloud SQL, GCS, secrets | DEV env file references secrets by name. Effective IAM not queried | Terraform env file | NOT TESTED live |
| File upload | Resume upload 8 MB | Size limit present. Malware scanning not present | `resumes.controller.ts`, `parse-resume.controller.ts` | PARTIAL. No malware scan |

## 5. Confirmed findings

### Fixed locally

| ID | Severity | Issue | Evidence | Fix | Verification |
|---|---|---|---|---|---|
| CB-SEC-01 | High | `POST /api/v1/resumes/worker/process` is `@Public()`. If `RESUME_TASK_SECRET` is empty, any caller who knows a `resumeId` and `userId` can start processing. Cloud Run sets `GCP_PROJECT_ID`, so a missing secret binding would fail open. DEV Terraform does bind the secret; the code on `origin/dev` (`567d544`) still uses `if (expected && providedSecret !== expected)`. | `resumes.controller.ts` public route; deployed source at `567d544` | Shared `cloudTaskSecretStatus` fails closed when `NODE_ENV=production` or `GCP_PROJECT_ID` is set and the secret is empty. Configured secrets are compared with `timingSafeEqual`. | `security-hardening.unit.test.ts`: missing secret on cloud is `missing_secret`; wrong secret is `mismatch`; exact secret is `ok`. 7/7 passed. Not deployed |
| CB-SEC-11 | High | `POST /api/v1/whatsapp/tasks/run` is `@Public()` and can send an interview invitation or reminder. On `origin/dev` the check is `if (expected && secret !== expected)`, so an empty `WHATSAPP_TASK_SECRET` accepts any caller. | `whatsapp.controller.ts` on `567d544` | Same `cloudTaskSecretStatus` helper. Empty secret on Cloud Run returns 403 "Task secret is not configured." | Unit test "uses the same fail-closed rule for the WhatsApp task callback". The endpoint was not called. Not deployed |
| CB-SEC-02 | Medium | `GET /api/v1/platform/stats` is public and the controller used `@SkipThrottle()`, so the global 60/min production limit did not apply. The handler counts candidates and loads distinct cities. | `platform.controller.ts` class decorator | Removed the class-level skip. Client-error reports keep their own 10/min limit. | Code review of the decorator. No separate runtime test |
| CB-SEC-03 | Medium | `POST /api/v1/resumes/structure-text` is public, calls Gemini when configured, and `rawText` had a minimum length but no maximum. | `StructureResumeTextDto` | `@MaxLength(20_000)` and `@Throttle({ default: { limit: 8, ttl: 60000 } })` | Code review. Live rate-limit response NOT TESTED |
| CB-SEC-04 | Low | No `X-Content-Type-Options`, `X-Frame-Options`, or `Referrer-Policy` on API or web responses. Swagger UI mounted whenever the process starts, including production. | `main.ts`, `next.config.ts` | API sets those headers and HSTS only when `NODE_ENV=production`. Swagger is omitted in production. Web sets nosniff, `DENY` framing, referrer policy, and a Permissions-Policy that still allows camera, microphone, and geolocation on the same origin. | Header unit tests passed. Deployed headers NOT TESTED |

### Confirmed advisories, not fixed

These come from `npm audit --omit=dev`. They were not upgraded. CI already records this audit as report-only. A scanner hit is not, by itself, proof of exploitability in this deployment.

| Package | Audit severity | Installed after this pass | Status |
|---|---|---|---|
| `next` | was critical at 16.3.1 (range through 16.3.7, including SSRF in Image Optimization below 16.3.8) | 16.3.8 exact, plus matching `@next/swc-*` and `@next/env` | FIXED in the lockfile and in `node_modules`. Absent from `npm audit --omit=dev`. Web `images.unoptimized` is already true. Not on the live web image |
| `proxy-addr` | was critical at 2.0.7 | 2.0.8 | FIXED in the lockfile. `express@4.22.1` accepts `~2.0.7`, which includes 2.0.8. Root `overrides` pins 2.0.8. npm 11.17.0 did not apply that override on the first `npm install`; `npm update proxy-addr` wrote 2.0.8 into the lockfile. `npm ci` will install the lockfile pin. Not deployed |
| `eslint-config-next` and `@next/eslint-plugin-next` | high at 16.3.1 in a full audit (devDependencies) | 16.3.8 | FIXED in the dev tree. Omitted from the production audit. Present in the web image build stage because that Dockerfile uses `npm ci --include=dev`; the runner stage copies the Next standalone output, not the ESLint package |
| `sharp` | was listed high at 0.35.3 | 0.35.5, pulled with Next 16.3.8 | No longer in the production high set |
| `multer` | high, range `<=2.2.0` | 2.0.2 | UNRESOLVED. `@nestjs/platform-express@10.4.22` depends on `multer` 2.0.2 exactly, so the audit also flags that Nest package. An override to `>=2.3.0` was not applied. It would change multipart parsing for resume uploads and needs approval plus upload tests |
| `@grpc/grpc-js` 1.9.16 via Firebase, plus `@firebase/firestore` and `firebase` | high | unchanged | UNRESOLVED. Firebase Admin configuration NOT TESTED |
| `nodemailer` 9.0.5 | high | unchanged | UNRESOLVED. Call sites not fully traced |
| `lodash` 4.17.21 | high, `_.template` | unchanged | UNRESOLVED. No `_.template` use was confirmed |
| `glob` 10.4.5 | high, CLI `-c` | unchanged | UNRESOLVED. Application call path NOT TESTED |
| `js-yaml` 4.1.0, `brace-expansion`, `source-map-js` | high | unchanged in production | UNRESOLVED |
| `body-parser` 1.20.4 | was listed high | unchanged | No longer in the production high set of this audit |
| `concurrently` 9.2.4 and `shell-quote` 1.9.0 | critical in a full audit | unchanged, `dev: true` | UNRESOLVED for local tooling. Not in the API runtime install. Not copied into the web runner. Not upgraded |

### Residual risks (not changed)

| ID | Severity | Risk | Why it was left |
|---|---|---|---|
| CB-SEC-05 | Medium | Access and refresh tokens are stored in `localStorage`. Any XSS can read them. | Moving to HttpOnly cookies changes the auth design. No stored-XSS sink was confirmed in the reviewed `dangerouslySetInnerHTML` sites |
| CB-SEC-06 | Medium | Password login allows 200 requests per minute per IP (`auth.controller.ts`). OTP request is also 200/min, with a separate 5-per-15-minutes cap per email or phone | Tightening can lock out shared NATs and the existing auth tests. Per-account OTP cap is the stronger control |
| CB-SEC-07 | Low | API container runs as root (`Dockerfile.api` has no `USER`). Web image uses `USER nextjs` | Changing the API user can break the entrypoint. Not deployed |
| CB-SEC-08 | Low | Human-mock signaling routes are public and `@SkipThrottle()`. Join still requires the join token or the owning user | Token entropy and live room takeover were NOT TESTED. No message was sent |
| CB-SEC-09 | Info | `GET /api/v1/platform/stats` is still public and returns candidate count, published job count, and city cardinality | Intended for the landing page. Throttle is now the global limit |
| CB-SEC-10 | Info | Password login throttle and refresh had no extra per-route cap on refresh before this pass. Refresh is still on the global limiter only | Not changed, to avoid locking legitimate clients |

`toSession` for human mocks returns `interviewerJoinUrl` including the join token to the candidate who owns the interview. That is how the interviewer link is shared. It is not an unauthenticated disclosure by itself. Token strength was NOT TESTED.

## 6. Authorization notes from source

Global order: `ThrottlerGuard`, then `JwtAuthGuard`. `RolesGuard` is applied per controller.

Sensitive groups observed with `RolesGuard`: candidates, applications, resumes (except the two public routes above), assessments, interviews, courses, employers, matching, GST, admin, WhatsApp admin, admin testimonials.

Public on purpose: health, auth login/OTP/refresh, locations, skills, catalog list, published jobs list/detail/nearby, public testimonials, platform stats, WhatsApp webhook, resume structure-text, resume worker, human-mock join/signal with token or owner.

`parse-resume` is not `@Public()`. The global JWT guard still requires a signed-in user. It does not add a role restriction, so any authenticated role can call it. That is broader than candidate-only, and it was not changed.

Live checks that were **not** run: candidate A reading candidate B, employer A reading employer B, candidate calling admin export, expired JWT, revoked refresh, suspended user.

## 7. Sensitive data

Inspected `apps/api/src/common/crypto/pii-crypto.ts`.

- Format `pii:v1:<keyId>:<iv>:<tag>:<ciphertext>`, AES-256-GCM, 12-byte IV, AAD includes field name and key id.
- Partial keyring configuration throws `PiiConfigError` instead of encrypting with a partial setup.
- Lookup uses a separate HMAC key.
- Deploy workflow checks that the DEV API service references the named PII secrets before deploy. Secret values were not retrieved.

Not verified: plaintext legacy rows, backup encryption, log redaction of KYC values, signed URL IAM, or admin export contents. No records were decrypted or rewritten.

## 8. Integrations

WhatsApp: signature helper tests exist and require HMAC when the app secret is set. This assessment did not call Meta and did not send a WhatsApp message.

Email, GST, Document AI, and Firebase were not called. GST routes have their own throttles. Firebase Admin absence fails mobile OTP closed when dev OTP is off (`auth.service.ts`).

## 9. Infrastructure and CI (declared config only)

- CI: `contents: read`, gitleaks on the change range, npm audit report-only, Docker build without push on pull requests.
- Deploy DEV: push to `dev` or manual dispatch, OIDC `id-token: write`, PII preflight, then API then web. Workflow does not print secret values in the portion reviewed.
- No `pull_request_target` workflow was found.
- Effective branch protection, Cloud SQL users, bucket IAM, and Secret Manager IAM: **NOT TESTED**.

## 10. OWASP mapping (not a certification)

| Area | Requirement theme | Result |
|---|---|---|
| ASVS V2 Authentication | Login throttling, OTP cap | Partial. Per-account OTP cap exists. Login IP limit is loose. Session storage is localStorage |
| ASVS V3 Session | Token storage and logout | NOT TESTED for revocation. Token is readable by script |
| ASVS V4 Access control | Role checks, object ownership | Source review partial. Live BOLA NOT TESTED |
| ASVS V5 Input | Validation pipe whitelist, Prisma parameters, upload size | PASS on inspected query builders. Upload malware scanning absent |
| ASVS V6 Cryptography | PII AES-GCM | PASS in source. Operational key use NOT TESTED |
| ASVS V7 Errors/logging | Client error logger strips newlines and slices length | PASS for that handler. Full log review NOT TESTED |
| ASVS V9 Communications | TLS at Cloud Run, new HSTS header in production code | Header not deployed. TLS termination NOT TESTED |
| ASVS V10 Malicious code | Dependency audit | FAIL until advisories are triaged or upgraded |
| ASVS V14 Config | Swagger, headers, non-root | Headers/Swagger fixed locally. API image still root |
| API Top 10 API1 BOLA | Object ids | NOT TESTED live |
| API2 Broken auth | JWT + public worker | Worker fail-open fixed locally |
| API3 Object property | whitelist pipe `forbidNonWhitelisted` | PASS for DTO routes using the global pipe |
| API4 Resource consumption | Throttles | Stats skip removed. structure-text tightened. Login still 200/min |
| API5 Function auth | RolesGuard | Present where declared. parse-resume has JWT only |
| API6 Sensitive business flows | Interviews, KYC, WhatsApp | Source review only |
| API7 SSRF | Outbound fetch | NOT TESTED |
| API8 Misconfiguration | Headers, Swagger, root container | Partial local fix |
| API9 Inventory | Swagger hidden in production code | Local fix only |
| API10 Unsafe consumption | Webhook HMAC | Helper reviewed. Live replay NOT TESTED |

## 11. Remediation files

Local only. Not committed. The checkout is `dev` at `c944dbb`, 15 commits behind `origin/dev` (`567d544`). These edits sit on that older base, in a working tree that also contains unrelated uncommitted work. They were not rebased.

Phase 1 dependency and task-secret files:

- `package.json` — `overrides.proxy-addr` = `2.0.8`
- `package-lock.json` — `next` 16.3.8, `proxy-addr` 2.0.8, `eslint-config-next` 16.3.8, `sharp` 0.35.5. npm 11 also rewrote lockfile paths while installing the ESLint config. Production version changes besides those pins are the matching `@next/*` packages and the `sharp` platform packages.
- `apps/web/package.json` — `next` and `eslint-config-next` exact `16.3.8`
- `apps/api/src/common/tasks/task-secret.ts` — shared fail-closed comparison
- `apps/api/src/resumes/resume-worker-auth.ts` — re-exports that helper
- `apps/api/src/whatsapp/whatsapp.controller.ts` — task callback uses the helper
- `apps/api/src/resumes/security-hardening.unit.test.ts` — WhatsApp case added

Earlier local fixes, still uncommitted and still absent from `origin/dev`:

- `apps/api/src/resumes/resumes.service.ts`
- `apps/api/src/resumes/resumes.controller.ts`
- `apps/api/src/common/http/security-headers.ts`
- `apps/api/src/main.ts`
- `apps/api/src/platform/platform.controller.ts`
- `apps/web/next.config.ts`

## 12. Blocked or not tested

- Live horizontal and vertical privilege tests against DEV or any database. Source review did not find a missing ownership check on candidate resume download (`requireResume` filters by the caller's candidate id) or employer resume download (an application for that employer is required). `parse-resume` requires a JWT and does not restrict the role. Those were not called live.
- gitleaks 8.30.1 is not installed on this workstation. Full history was not scanned. CI still scans only the commits introduced by a change.
- Container CVE scan, Terraform plan, and effective GCP IAM. Cloud Run traffic and image tags were read. IAM policies were not. Docker is not installed here, so the non-root API image was not built.
- WhatsApp, email, GST, and Document AI calls. Nodemailer tests use a fake transport.
- HttpOnly session cookies and tighter login limits. Designs are in section 15. They are not implemented.
- Production or UAT. No resources were created. Nothing in this tree was committed or pushed.

## 13. Follow-up

1. Review branch `security/dev-remediation` in `C:\Users\ADMIN\Desktop\CareerBridge-security`. It is `origin/dev` (`567d544`) plus the security diff. Do not commit the dirty checkout at `c944dbb`.
2. Decide the Firebase/`@grpc/grpc-js` upgrade separately. Do not downgrade `firebase` to 9.14.0.
3. Deploy only after review. Live web is still `3228dd28` and live API is still `567d544`.
4. Build the API image in an environment with Docker and confirm `prisma migrate deploy` runs as user `api`.
5. Run an authorized DEV authorization matrix with synthetic accounts. Do not use real customer records.
6. Schedule the session-cookie migration and the login lockout in section 15 as their own changes.

## 14. Readiness decision

Criteria not met. DEV is not secure, and it is not ready to promote.

- The security fixes now sit on current `origin/dev` in the worktree above. They are uncommitted. Live Cloud Run does not run them.
- Production `npm audit --omit=dev` after the dependency patches: critical=0, high=4, moderate=14, low=2, total=20. The four highs are `firebase` 11.10.0, its Firestore packages, and `@grpc/grpc-js` 1.9.16. `next`, `proxy-addr`, `multer`, `lodash`, `js-yaml`, `glob` 10.4.5, `brace-expansion`, `source-map-js`, and `nodemailer` are absent from that high set.
- A full `npm audit` (including devDependencies) reports critical=0. `concurrently` and `shell-quote` are absent.
- Authorization was not executed as candidate A against candidate B on the running API.
- gitleaks was not run. Effective IAM was not read. The API image was not built.

## 15. Phase 2 remediation on origin/dev

The security files were copied onto a new worktree at `origin/dev` after confirming those paths had no diff between `c944dbb` and `567d544`. The original checkout was not reset, cleaned, committed, or pushed. Unrelated dirty files stayed there.

### Dependency highs

| Finding | Installed before | Parent | Action |
|---|---|---|---|
| `multer` <=2.2.0 | 2.0.2 | `@nestjs/platform-express@10.4.22` exact pin | Lockfile now 2.4.0, the version Nest 12.1.3 itself depends on. Nest 11.1.14 still pins 2.0.2, so a Nest upgrade is not a smaller fix. Nest 10 calls `multer().single()`. File-size message is still `File too large`. The unexpected-field message changed, so the API exception filter maps Multer `code` to 413 or 400. |
| `lodash` <=4.17.23 | 4.17.21 | `@nestjs/config` and `@nestjs/swagger` exact 4.17.21 | 4.18.1. No `_.template` in this repo. 4.17.23 is still inside the advisory range. |
| `js-yaml` 4.0.0–4.3.1 | 4.1.0 prod, 4.3.1 dev | `@nestjs/swagger` exact 4.1.0 | 4.3.2. Not yaml 5. |
| `glob` 10.2.0–10.4.5 | 10.4.5 | `@nestjs/cli` exact 10.4.5 (dev) and `rimraf` `^10.3.7` | 10.5.0. glob 7.2.3 under archiver was not part of this high range and was left in place. |
| `brace-expansion` <=1.1.20 or 2.0.0–2.1.6 | 1.1.18 and 2.1.4 | `minimatch` | 1.1.21 and 2.1.7. The 5.0.12 copy was already outside the range. |
| `source-map-js` 1.0.0–1.2.1 | 1.2.1 | `postcss`, `@tailwindcss/node` `^1.2.1` | 1.2.2 |
| `nodemailer` <=10.0.5 | 9.0.5 direct | `apps/api` | 10.1.0. Requires Node >=20. Call sites use `createTransport` and `sendMail` only. |
| `@grpc/grpc-js` <=1.13.5 | 1.9.16 | `firebase` 11.10.0 via Firestore `~1.9.0`, and `google-gax` | Not changed. npm's suggested fix downgrades `firebase` to 9.14.0. That is not compatible with the web app. Forcing grpc 1.14.6 through the `~1.9.0` pin was not applied. |
| `@nestjs/platform-express` | 10.4.22 | direct | No longer high after the multer pin. Nest was not upgraded to 12. |

npm 10 and npm 11 both ignored new `overrides` while `package-lock.json` already existed. Direct bumps (`nodemailer`, `concurrently`) and `npm update` (where the parent range allowed it) worked. The exact pins were written into the lockfile and `npm install` kept them. Root `overrides` still record the intended versions.

`concurrently` 9.2.4 pulled `shell-quote` 1.9.0. Both were critical only as devDependencies. `npm run dev` passes the static script strings from `package.json` to concurrently; it does not pass request data. `concurrently` is now 9.2.5, which depends on `shell-quote` 1.12.0. Both packages are absent from the full audit. They are not in the API runtime image.

### Resume upload checks

`node -r ts-node/register/transpile-only --test` on the filter test, the multer contract test, the task-secret test, and `email.service.unit.test.ts`: 27 passed. The multer test accepts a small PDF, returns `LIMIT_FILE_SIZE` / `File too large` over the limit, and returns `LIMIT_UNEXPECTED_FILE` for a different field name. After `prisma generate`, the three resume tests that load the Prisma client passed (23). `npm run build -w api` exited 0.

### Token storage design (not implemented)

Access and refresh tokens are in `localStorage` (`cb_access_token`, `cb_refresh_token`). `cb_auth=1` is a non-HttpOnly presence cookie for the Next middleware. The API trusts `Authorization: Bearer`, not that cookie. A cross-site form cannot attach the Bearer token, so classic CSRF does not reach authenticated API routes today. Any XSS can read the tokens. Impersonation also stores the admin session in `localStorage` (`cb_admin_backup`).

A later migration, without a flag day that drops every session:

1. Keep issuing the access token in the JSON body and hold it in memory only. Stop writing it to `localStorage`.
2. Set the refresh token in an `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth` cookie from `POST /auth/login`, OTP verify, and refresh. Clear it on logout.
3. Because that cookie will be sent by the browser, protect refresh with a header the web app sets (`X-CareerBridge-Request: 1`) and allow that header only from `WEB_ORIGIN`. SameSite=Lax blocks cross-site POST from embedded contexts. A custom header forces a CORS preflight, so a foreign site cannot complete the refresh.
4. Do not move every API call onto cookies. That would make CSRF protection required on all state-changing routes. Bearer access tokens avoid that.
5. Existing `localStorage` sessions keep working until logout: if a refresh token is still in storage, send it once in the body, then store only the cookie. Impersonation must keep the admin refresh token in a second HttpOnly cookie, not in `localStorage`.

### Password-login limits (not implemented)

`POST /auth/login` replaces the global limiter with 200 requests per minute per IP. There is no per-account failure counter. OTP verification already stops at 5 attempts per identifier per 15 minutes. Admin login is 40 per minute per IP.

Proposed controls, left unapplied because they change sign-in for shared NATs:

- 20 password attempts per minute per IP. That still allows a college or office NAT to retry, and it is far below 200.
- 10 failed passwords per email or mobile number per 15 minutes, with the same "incorrect email, mobile number, or password" response so the lock does not reveal whether the account exists.
- Admin login: 10 per minute per IP, plus the same per-email failure lock.
- Leave refresh on the global limiter.

### API container user

`infrastructure/docker/Dockerfile.api` creates user `api` (uid 1001) and sets `USER api` for the runtime stage. `HOME=/home/api` is writable. Application files and `node_modules` stay root-owned. `docker-entrypoint.sh` runs `/app/node_modules/.bin/prisma`, which the image already installs, instead of `npx --yes prisma@6`. Port 8080 does not need root. The image was not built on this machine because Docker is not installed.

## 16. Phase 3 — Firebase/gRPC decision, revalidation, and design review

Date: 2026-10-12. Worktree `C:\Users\ADMIN\Desktop\CareerBridge-security`, branch `security/dev-remediation`, HEAD `567d544`. No commit, push, deploy, Terraform apply, DNS change, secret creation, or image promotion. The checkout at `C:\Users\ADMIN\Desktop\CareerBridge` was not edited in this pass.

### Remaining production audit

`npm audit --omit=dev --json` exit code 1.

| Severity | Count |
|---|---|
| critical | 0 |
| high | 4 |
| moderate | 14 |
| low | 2 |
| total | 20 |

`npm audit --json` (devDependencies included) exit code 1: critical=0, high=17, moderate=19, low=5, total=41.

The four production highs are one chain. npm's `fixAvailable` for each of them is `firebase@9.14.0` with `isSemVerMajor: true`.

| Package | Installed | Lockfile path | Advisory | Affected range reported by npm | Patched line |
|---|---|---|---|---|---|
| `@grpc/grpc-js` | 1.9.16 | `node_modules/@grpc/grpc-js` | [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) high, CWE-295, CVSS 7.4. `getAuthContext` can treat an unauthorized certificate as authorized. Source 1240623. Range on the advisory object: `<1.13.6`. | Package range `<=1.13.5` | 1.13.6 and later. The 1.14.5 and 1.14.6 copies in this lockfile are outside the current npm range and are not listed as vulnerable nodes |
| `@grpc/grpc-js` | same 1.9.16 node | same path | [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4) low, CWE-550, CVSS 3.7. A server can send some method-handler error text to the client. Source 1240625. Range `<1.13.6` | same | same |
| `@firebase/firestore` | 4.8.0 | `node_modules/@firebase/firestore` | High only through `@grpc/grpc-js` | npm range starts at several 1.x canaries and includes `>=3.8.0-20221206221533` | npm offers no patched Firestore version; it points at `firebase@9.14.0` |
| `@firebase/firestore-compat` | 0.3.53 | `node_modules/@firebase/firestore-compat` | High only through `@firebase/firestore` | `>=0.3.0-20221206221533` and older canaries | same downgrade |
| `firebase` | 11.10.0 | `node_modules/firebase` | High only through the two Firestore packages | `>=9.15.0-20221206221533` plus older ranges | `firebase@9.14.0` |

`firebase` 11.10.0 depends on `@firebase/firestore` 4.8.0, which depends on `@grpc/grpc-js` `~1.9.0`.

### What the API runtime install contains

`npm ls @grpc/grpc-js firebase @firebase/firestore @firebase/firestore-compat --omit=dev --all -w api` exit 0. The API workspace tree does not contain `firebase`, `@firebase/firestore`, or `@grpc/grpc-js` 1.9.16. It contains:

| Parent | Installed `@grpc/grpc-js` | Parent range in the lockfile |
|---|---|---|
| `@google-cloud/documentai@9.6.2` → `google-gax@5.0.8` | 1.14.5 | `^1.12.6` |
| `@google-cloud/tasks@7.1.0` → `google-gax@6.1.0` | 1.14.6 | `^1.12.6` |
| `firebase-admin@13.10.0` → optional `@google-cloud/firestore@7.11.6` → `google-gax@4.6.1` | 1.14.6 | `^1.10.9` |

`infrastructure/docker/Dockerfile.api` installs that set with `npm ci --omit=dev --ignore-scripts -w api -w @careerbridge/shared`, then `npm install prisma@6 --no-save`. The web client `firebase` package is not part of that install. It is a production dependency of `apps/web`, so the monorepo production audit still counts it. The web runner copies Next standalone output from the builder. This pass did not build that image, so it did not prove whether the standalone trace contains `@grpc/grpc-js`.

The two copies that were 1.14.4 (`@google-cloud/tasks` and the optional `google-gax` used by `@google-cloud/firestore`) were moved to 1.14.6. Both parent ranges already allowed 1.14.6, and 1.14.6 has the same direct dependencies as 1.14.4 (`@grpc/proto-loader` `^0.8.0`, `@js-sdsl/ordered-map` `^4.4.2`). Document AI was already on 1.14.5. No root `overrides` entry was added for `@grpc/grpc-js`. Section 15's note that grpc was left unchanged describes the tree before this in-range bump.

### Why a Firebase upgrade does not clear the finding

Registry versions read on 2026-10-12:

| Package | Firestore dependency | Firestore's `@grpc/grpc-js` |
|---|---|---|
| `firebase@11.10.0` (installed) | 4.8.0 | `~1.9.0` |
| `firebase@12.9.0` | 4.11.0 | `~1.9.0` |
| `firebase@13.0.0` | 4.18.0 | `@firebase/firestore@4.18.0` depends on `@grpc/grpc-js` `~1.9.0` |

`~1.9.0` cannot install 1.13.6 or 1.14.6. A compatible SDK upgrade that stays on current Firebase 11, 12, or 13 therefore cannot clear GHSA-m9gg-hp2v-232j. Downgrading the web app to `firebase@9.14.0` is the only fix npm offers, and that major downgrade was not applied.

### Application use of the affected API

No `firestore` or `getFirestore` import exists under `apps/api/src` or `apps/web/src`. The web client uses `firebase/auth` (phone OTP) and `firebase/messaging`. The API uses `firebase-admin` `auth().verifyIdToken` and `messaging().sendEachForMulticast`. The optional Admin Firestore package is installed because npm installs optional dependencies; application code does not call it. This service does not run a gRPC server, which is the setting for GHSA-f596-whhp-79r4. GHSA-m9gg-hp2v-232j is a client certificate check inside `@grpc/grpc-js`. The copies that Cloud Tasks, Document AI, and the optional Admin Firestore client load are 1.14.5 and 1.14.6.

### Decision

Keep the temporary exception for `firebase` 11.10.0 / `@firebase/firestore` 4.8.0 / `@grpc/grpc-js` 1.9.16. Do not override `@grpc/grpc-js` and do not downgrade Firebase. Re-check when `@firebase/firestore` publishes a dependency on `@grpc/grpc-js` `>=1.13.6`. The 1.14.6 bump for the Cloud Tasks and optional Admin Firestore clients stays, because those parent ranges already allowed it.

Full-audit highs that are outside the production set, and were not overridden: `@nestjs/cli`, `@next/eslint-plugin-next`, `eslint-config-next`, `fast-glob`, `micromatch`, `braces` ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)), `chokidar`, `picomatch` ([GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p), [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj)), `fork-ts-checker-webpack-plugin`, `prisma` / `@prisma/config` via `deepmerge-ts` ([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)), and `tmp` ([GHSA-52f5-9888-hmc6](https://github.com/advisories/GHSA-52f5-9888-hmc6), [GHSA-ph9p-34f9-6g65](https://github.com/advisories/GHSA-ph9p-34f9-6g65)). These are dev-tool or CLI packages. `concurrently` and `shell-quote` remain absent.

### Tests and builds in this pass

All commands ran in the security worktree. Exit 0 unless noted.

| Command | Result |
|---|---|
| `npm run test:auth -w api` | 39 passed, 0 failed |
| `npm run test:email -w api` | 14 passed, 0 failed |
| `npm run test:whatsapp -w api` | 29 passed, 0 failed |
| `npm run test:whatsapp-flow -w api` | 29 passed, 0 failed |
| `npm run test:employer -w api` | 129 passed, 0 failed |
| `npm run test:admin -w api` | 222 passed, 0 failed |
| `npm run test:interview -w api` | 21 passed, 0 failed |
| `npm run test:pii -w api` | 25 passed, 0 failed |
| `npm run test:resume -w api` | 87 passed, 0 failed, 2 skipped. The skips are missing PDF fixtures (`original-resume.pdf`, `portal-downloaded-resume.pdf`). The multer 2.4 contract passed: small file accepted, oversized file `LIMIT_FILE_SIZE`, unexpected field `LIMIT_UNEXPECTED_FILE` |
| `npm run test:ai -w api` | 16 passed, 0 failed |
| `npm run test:match -w api` | 5 passed, 0 failed |
| `npm run test:photo -w api` | 42 passed, 0 failed |
| `npm run test:gst -w api` | 14 passed, 0 failed |
| `npm run test:rag -w api` | 44 passed, 0 failed |
| `npm run test:testimonials -w api` | 34 passed, 0 failed |
| `npm run test:gst:integration -w api` | Exit 0. Suite skipped because `GST_RUN_INTEGRATION` is unset. The GST sandbox was not called |
| `npm run test:testimonials:integration -w api` | Exit 0. Suite skipped because `TESTIMONIALS_IT_DATABASE_URL` is unset. No database was used |
| `node -r ts-node/register/transpile-only --test src/common/filters/http-exception.filter.unit.test.ts` | 3 passed, 0 failed. Multer file-size maps to 413, unexpected field to 400, Prisma `P2002` stays 409 |
| `npm test -w @careerbridge/shared` | 75 passed, 0 failed |
| `node --test .github/scripts/pii-deploy-preflight.test.mjs` | 14 passed, 0 failed |
| Web `*.unit.test.ts` (22 files, run with ts-node from `apps/api`) | 151 passed, 0 failed |
| `npm run build -w api` | Exit 0 |
| `npm run build -w web` | Exit 0. Next.js 16.3.8 compiled, typecheck finished, 101 static pages generated |

Unit totals for the commands that executed tests: 993 passed, 0 failed, 2 skipped. The two integration suites did not run their checks.

### Container status

`where.exe` found no `docker`, `podman`, `nerdctl`, or `gitleaks`. Nothing was installed and Cloud Build was not used. The API image was not built, so these checks remain undone: runtime user is UID 1001, Prisma starts from the image binary without a package download, OS and application CVE scan, absence of secrets and devDependencies in the image layers, and a container smoke test. The Dockerfile and entrypoint say `USER api` (uid 1001) and call `/app/node_modules/.bin/prisma`. That is source review only. The container is not claimed to be secure.

### Token storage (design only, not implemented)

`apps/web/src/lib/session.ts` writes `cb_access_token`, `cb_refresh_token`, and `cb_user` to `localStorage`. Any script that runs in the origin can read them. `cb_auth=1` is set with `document.cookie` as `Path=/; SameSite=Lax` for 30 days. It is not `HttpOnly`, it has no `Secure` flag, and its value is the constant `1`. Next middleware uses it as a presence flag. The API accepts `Authorization: Bearer` and does not read that cookie.

`POST /api/v1/auth/refresh` takes `{ refreshToken }` in the JSON body (`RefreshDto`). It verifies the JWT, finds an unrevoked row by token hash or `jti`, rejects an expired row or a subject mismatch, sets `revokedAt`, and issues a new session. `POST /api/v1/auth/logout` requires the access token. With a refresh token it revokes that hash or `jti` for the signed-in user. Without one it revokes every refresh token for that user. Impersonation backup is `localStorage` key `cb_admin_backup`.

CORS allows the comma-separated `WEB_ORIGIN` list (default `http://localhost:3000`) with `credentials: true`. A cross-site form cannot attach the Bearer token, so the current API is not exposed to classic cookie CSRF.

Proposed migration, still not implemented:

1. Hold the access token in memory only. Stop writing it, the refresh token, and the admin backup to `localStorage`.
2. Set the refresh token from login, OTP verify, and refresh as `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth`. Clear that cookie on logout.
3. Because the browser will send that cookie, refresh and logout must require `X-CareerBridge-Request: 1` and an `Origin` in the `WEB_ORIGIN` list. SameSite=Lax withholds the cookie on cross-site POST. The custom header forces a CORS preflight, so a foreign origin cannot complete the call.
4. Keep API calls on Bearer access tokens. Moving every route to a cookie would require CSRF protection on every state-changing route.
5. During migration, accept a refresh token from the JSON body as well as the cookie, so an existing `localStorage` session can refresh once and then continue with the cookie. Logout must clear the cookie and still revoke a body token presented by an old client.

### Login limits (design only, not implemented)

`ThrottlerModule.forRoot` in `app.module.ts` sets one in-memory limiter: 60 requests per minute in production and 300 otherwise. No Redis or Memorystore storage is configured. `@Throttle` on a route replaces that limit for the route. Current auth limits: password login 200/minute per IP, admin login 40/minute per IP, OTP request and verify 200/minute per IP, employer register and password reset 100/minute per IP. Refresh uses the global limiter. OTP verification also stops at 5 attempts per identifier per 15 minutes in the service. Password login has no per-account failure counter. `loginWithPassword` uses the same error for an unknown identifier and a wrong password.

The in-memory counter is per Cloud Run instance. Instances do not share it, a new instance starts at zero, and request routing is not sticky. The effective ceiling is the configured limit multiplied by the number of instances.

Proposed limits, left unapplied:

- 20 password attempts per minute per IP.
- 10 failed passwords per email or mobile number per 15 minutes, with the same incorrect-identifier response.
- Admin login: 10 per minute per IP, plus the same per-email failure lock.
- Refresh stays on the global limiter.

A shared NAT puts every user behind one public IP into the same IP bucket on whichever instance receives the request. Twenty per minute is the proposed room for an office or college NAT. It will still throttle a large NAT during a busy minute, and it will not hold an attacker to 20 per minute once several instances are running. The per-identifier failure counter has the same per-instance split. These limits should not be described as global until the counters live in a shared store. Adding Memorystore is an infrastructure change and is not part of this design.

### Still outstanding

- Live authorization matrix, effective IAM, Cloud SQL grants, and Secret Manager access were not read or changed.
- gitleaks is not installed. History was not scanned locally. CI still scans only the commits introduced by a change.
- The API image was not built or scanned.
- Token storage and the tighter login limits are not implemented.
- Live DEV still runs the images recorded in section 1. This pass did not call Cloud Run, Terraform, or a deploy workflow. Production and UAT were not created or changed.
- Security-readiness remains **not met**.

## 17. Phase 4 — pre-deployment verification

Date: 2026-10-13. Worktree `C:\Users\ADMIN\Desktop\CareerBridge-security`, branch `security/dev-remediation`, HEAD `567d544`. No commit, push, deploy, Terraform apply, DNS change, secret creation, Cloud Build, or image promotion. The checkout at `C:\Users\ADMIN\Desktop\CareerBridge` was not edited.

### Audits re-run

`npm audit --omit=dev --json` exit 1: critical=0, high=4, moderate=14, low=2, total=20.

`npm audit --json` exit 1: critical=0, high=17, moderate=19, low=5, total=41.

The four production highs are unchanged: `firebase@11.10.0` (`node_modules/firebase`), `@firebase/firestore@4.8.0`, `@firebase/firestore-compat@0.3.53`, and `@grpc/grpc-js@1.9.16` (`node_modules/@grpc/grpc-js`). Advisories remain [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) and [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4). npm still offers only `firebase@9.14.0`. That downgrade was not applied, and no `@grpc/grpc-js` override was added. The section 16 exception stands.

The 13 additional full-audit highs are the same dev-tool chain listed in section 16.

### Web standalone artifact

`npm run build -w web` on 2026-10-13 exited 0 (Next.js 16.3.8). A walk of all 3,332 files under `apps/web/.next/standalone` found no directory named `grpc-js` or `firestore`, and no file containing `@grpc/grpc-js` or `grpc-js-1.9.16`. The traced `node_modules` in that output are `@img`, `@next`, `@opentelemetry`, `@swc`, `client-only`, `detect-libc`, `next`, `react`, `react-dom`, `semver`, `sharp`, and `styled-jsx`.

`firebase/app` is bundled into a server chunk. That chunk names `@firebase/firestore` only as a component alias (`fire-fst`) inside `@firebase/app` 0.13.2 / Firebase SDK 11.10.0. It does not include the Firestore implementation or `@grpc/grpc-js`. The Docker web runner copies this standalone directory. The image itself was not built, so this is evidence about the local production artifact, not about a published container.

### Task callbacks

`cloudTaskSecretStatus` fails closed for a missing, empty, or whitespace-only expected secret when `NODE_ENV` is `production` or `GCP_PROJECT_ID` is set (`missing_secret`). A configured secret with a missing header, an empty header, or a different value returns `mismatch`. An exact match returns `ok`. Local development without a cloud project id still allows an empty secret. Resume worker and WhatsApp task callback both use this function. The resume worker throws `Resume worker credentials are not configured.` or `Invalid resume worker credentials.` The WhatsApp callback throws `Task secret is not configured.` or `Invalid task secret.` Both routes are `@Public()`. After the secret check, the resume worker still requires the resume to belong to the supplied `userId`.

The security-hardening unit test now asserts the empty-header and whitespace-secret cases. `npm run test:resume -w api` includes that file: 87 passed, 0 failed, 2 skipped (missing PDF fixtures).

### parse-resume authorization

`ParseResumeController` has no `@Public()` and no `@Roles()`. The global `JwtAuthGuard` requires a valid access token. `JwtStrategy` rejects refresh tokens and any user whose status is not `ACTIVE`. `RolesGuard` is not global, and this controller does not use it, so every active account type can call `POST /api/v1/parse-resume` and `POST /api/v1/parse-resume/authenticated`:

- `CANDIDATE`
- `EMPLOYER_ADMIN`
- `EMPLOYER_RECRUITER`
- `SUPER_ADMIN`
- `PLATFORM_ADMIN`
- `PLATFORM_OPERATOR`

The Next route `apps/web/src/app/api/parse-resume/route.ts` proxies to the API and forwards `Authorization` when the caller sends it. It does not add its own role check. A caller without a bearer token is rejected by the API guard. No role restriction was added: employers and candidates both use resume parsing, so a narrower role list is not an unambiguous product rule.

### Tests and builds

| Command | Result | Exit |
|---|---|---|
| API unit suites listed in section 16, re-run | 750 passed, 0 failed, 2 skipped | 0 |
| Multer exception filter | 3 passed | 0 |
| `@careerbridge/shared` | 75 passed | 0 |
| PII deploy preflight | 14 passed | 0 |
| Web unit tests, 22 files | 151 passed | 0 |
| `npm run build -w api` | Nest build | 0 |
| `npm run build -w web` | Next.js 16.3.8 | 0 |

Executed tests: 993 passed, 0 failed, 2 skipped. GST sandbox integration and testimonials Postgres integration exited 0 with the suites skipped (`GST_RUN_INTEGRATION` and `TESTIMONIALS_IT_DATABASE_URL` unset). Those integration paths were not exercised.

### Container

`docker`, `podman`, `nerdctl`, and `gitleaks` are still absent. Nothing was installed. The API image was not built or scanned. UID 1001, Prisma startup, image contents, and a container smoke test remain unverified. The container is not claimed to be secure.

### Go / no-go

**No-go for deployment.** The local code checks above passed, and `@grpc/grpc-js@1.9.16` is not in the web standalone artifact, but a deploy is still blocked by:

- The API container was not built or scanned.
- Live authorization, IAM, Cloud SQL grants, Secret Manager, and a history secret scan were not run.
- These fixes are uncommitted and are not running on DEV.
- Access and refresh tokens remain in `localStorage`. The cookie design in section 16 is not implemented.
- The Firebase/gRPC lockfile exception remains. It is accepted only as a dependency-audit finding, not as a component of the web runtime artifact.

## 18. DEV IAM least-privilege plan (not applied)

Date: 2026-10-13. Read-only inspection of project `careerbridge-f7b72`, region `asia-south1`. Every gcloud command set `--project=careerbridge-f7b72` explicitly. No IAM binding, service account, secret, API, or Cloud Run revision was changed. Secret values were not read. `gcloud projects get-ancestors careerbridge-f7b72` returned only the project, so this pass did not find a folder or organization policy to inherit. Cloud Asset Analyzer was not used.

Compared with the same-day review, the bindings below are unchanged: both services still use the default Compute Engine service account, that account still has project `roles/editor`, and both services still grant `allUsers` `roles/run.invoker`.

### Verified identities

| Resource | Runtime service account | Ingress | Ready revision |
|---|---|---|---|
| `careerbridge-api-dev` | `601892050765-compute@developer.gserviceaccount.com` | `all` | `careerbridge-api-dev-00084-8xb` |
| `careerbridge-web-dev` | same default Compute Engine account | `all` | `careerbridge-web-dev-00067-ctj` |

The web service has four plaintext env vars and no secret refs: `NODE_ENV`, `HOSTNAME`, `NEXT_TELEMETRY_DISABLED`, `API_INTERNAL_URL`. It does not mount Cloud SQL. The API mounts Cloud SQL instance `careerbridge-f7b72:asia-south1:careerbridge-dev-db` and the secret refs listed below.

### Project-level bindings (`careerbridge-f7b72`)

| Role | Member | Scope |
|---|---|---|
| `roles/editor` | `601892050765-compute@developer.gserviceaccount.com` | project |
| `roles/cloudsql.client` | same Compute Engine account | project |
| `roles/documentai.apiUser` | Compute Engine account and `firebase-adminsdk-fbsvc@careerbridge-f7b72.iam.gserviceaccount.com` | project |
| `roles/secretmanager.secretAccessor` | Compute Engine account | project |
| `roles/storage.objectAdmin` | Compute Engine account | project |
| `roles/iam.serviceAccountTokenCreator` | Firebase Admin SDK account | project |
| `roles/firebase.sdkAdminServiceAgent` | Firebase Admin SDK account | project |
| `roles/firebaseauth.admin` | Firebase Admin SDK account | project |
| `roles/owner` | `user:srsbhr25@gmail.com` | project |

`github-deploy-dev@careerbridge-f7b72.iam.gserviceaccount.com` has no project-level role.

### Resource-level bindings

| Resource | Role | Member |
|---|---|---|
| Cloud Run `careerbridge-api-dev` and `careerbridge-web-dev` | `roles/run.invoker` | `allUsers` |
| Both Cloud Run services | `roles/run.developer` | `github-deploy-dev` |
| Artifact Registry `careerbridge-dev` (`asia-south1`) | `roles/artifactregistry.writer` | `github-deploy-dev` |
| Service account `601892050765-compute@...` | `roles/iam.serviceAccountUser` | `github-deploy-dev` |
| Firebase Admin SDK service account | none | resource policy is empty |
| Queues `resume-processing` and `whatsapp-notifications` | none | both queues are `RUNNING`; enqueue is coming from project `roles/editor` |
| `gs://srsbbucket` | `roles/storage.objectAdmin` | Compute Engine account, Firebase Admin SDK account, `user:srsbhr25@gmail.com` |

`gs://srsbbucket` has uniform bucket-level access and public access prevention enforced. Its legacy bucket owners are `project-a1ebc83d-dd51-48f2-97d`, so the bucket is not owned by `careerbridge-f7b72`. Project-level `roles/storage.objectAdmin` on `careerbridge-f7b72` does not grant access to that bucket. The bucket binding does.

The API secret refs, names only, are: `careerbridge-db-password`, `careerbridge-gemini-api-key`, `careerbridge-whatsapp-access-token`, `careerbridge-whatsapp-verify-token`, `careerbridge-whatsapp-phone-number-id`, `careerbridge-whatsapp-task-secret`, `careerbridge-jwt-access-secret`, `careerbridge-jwt-refresh-secret`, `careerbridge-resume-task-secret`, `careerbridge-gstinapi-key`, `careerbridge-smtp-support-user`, `careerbridge-smtp-support-pass`, `careerbridge-whatsapp-app-secret` (all `version=latest`), plus `careerbridge-pii-encryption-keys` and `careerbridge-pii-lookup-key` (`version=1`). Cloud Run reads them as environment variables. The process does not call the Secret Manager API.

### API permission matrix

The API process uses Application Default Credentials of whichever service account Cloud Run assigns. `loadGcpCredentials` does not use the Firebase key for Storage, Document AI, or Cloud Tasks (`allowFirebaseSa: false`).

| Operation | Evidence | Current grant | Needed at | Replacement |
|---|---|---|---|---|
| Connect to Cloud SQL `careerbridge-dev-db` | API revision annotation; Prisma in the entrypoint | project `roles/cloudsql.client` on the Compute Engine account | runtime | `roles/cloudsql.client` on that instance for the new API account. Project scope is the fallback if instance IAM rejects the binding |
| `processDocument` | `resume-extractor.service.ts` | project `roles/documentai.apiUser` | runtime | same role for the new API account only. Processor-level binding was not verified |
| Read the 15 mounted secrets | Cloud Run env secret refs | project `roles/secretmanager.secretAccessor` | revision startup | `roles/secretmanager.secretAccessor` on each of those 15 secrets |
| Upload, download, and delete objects in `gs://srsbbucket` | `storage.service.ts`; callers in resumes, candidates, employers, and admin deletion | bucket `roles/storage.objectAdmin` | runtime | `roles/storage.objectUser` on `gs://srsbbucket`. No caller passes `isPublic: true`. The bucket has uniform access, so `makePublic` cannot grant public objects |
| Enqueue Cloud Tasks | `cloud-tasks.service.ts` posts to `resume-processing` and `whatsapp-notifications` with a shared-secret header and no `oidcToken` | project `roles/editor` | runtime | `roles/cloudtasks.enqueuer` on each queue |
| Write Cloud Run logs | stdout from the API process. No Monitoring client exists in `apps/api` | included in `roles/editor` | runtime | `roles/logging.logWriter` on the project. `roles/monitoring.metricWriter` is not required |
| Verify a Firebase ID token | `firebase.service.ts` `verifyIdToken` | none beyond the ability to fetch Google's public certificates | runtime | no Firebase admin role. Verification uses Google's published certificates |
| Send FCM | `sendEachForMulticast` on the same ADC identity | included in `roles/editor` | runtime | `roles/firebasecloudmessaging.admin` on the project for the API account |
| Sign a GCS URL | `getSignedUrl` in `storage.service.ts` | not held by the Compute Engine account. `readableResumeUrl` documents that Cloud Run ADC cannot sign and downloads the object instead | neither, unless signed URLs are approved later | do not add `roles/iam.serviceAccountTokenCreator` as part of removing editor |

`roles/editor` is not removed until every row above is granted to the new API account and the smoke tests pass. The owner binding is not part of this change.

### Web permission matrix

`apps/web` has no Cloud SQL, Document AI, Secret Manager, Cloud Tasks, or GCS client. The live web service mounts no secrets. Firebase Auth and Messaging run in the browser.

| Operation | Evidence | Needed at | Replacement |
|---|---|---|---|
| Serve the site and proxy `API_INTERNAL_URL` | Next standalone; deploy workflow curls the public URL | runtime | no data-plane role |
| Cloud Run request logs | a user-managed service account does not write logs without this. The web process does not call the Monitoring API | runtime | `roles/logging.logWriter` on the project. `roles/monitoring.metricWriter` is not required |

The web account does not get Cloud SQL, Document AI, Secret Manager, Storage, Cloud Tasks, FCM, or editor.

### Public invocation

Do not remove `allUsers` from either service in this plan.

The website is opened by browsers that have no Google identity. `deploy-dev.yml` checks health with an unauthenticated `curl`. Removing `roles/run.invoker` from `allUsers` on `careerbridge-web-dev` returns 403 before Next.js runs, so login, registration, and the deploy check stop.

The API uses application JWTs, not Cloud Run IAM, for candidates and employers. Browsers call it directly. Cloud Tasks targets are plain HTTP with `X-Resume-Task-Secret` or `X-WhatsApp-Task-Secret` and no OIDC token. Cloud Run rejects those calls unless the URL allows unauthenticated invocation or the task carries an identity that has `roles/run.invoker`. Removing `allUsers` from `careerbridge-api-dev` stops browser API calls, the web proxy, the health check, and both task callbacks.

Recommended settings, unchanged until a later approved design:

- Web: ingress `all`, `allUsers` keeps `roles/run.invoker`.
- API: ingress `all`, `allUsers` keeps `roles/run.invoker`. Application guards stay as they are. An OIDC token on both task types is a separate change and is required before API public invocation can be removed.

### Proposed accounts and role changes

Create these accounts only after approval. Do not attach them in this task.

- `careerbridge-api-runtime-dev@careerbridge-f7b72.iam.gserviceaccount.com`
- `careerbridge-web-runtime-dev@careerbridge-f7b72.iam.gserviceaccount.com`

Add, before either Cloud Run service changes account:

| Add | Principal | Resource |
|---|---|---|
| `roles/logging.logWriter` | both new accounts | project `careerbridge-f7b72` |
| `roles/cloudsql.client` | API account | instance `careerbridge-dev-db`, or the project if instance IAM is rejected |
| `roles/documentai.apiUser` | API account | processor `DOCUMENT_AI_PROCESSOR_ID` in `asia-south1`, or the project if processor IAM is rejected |
| `roles/firebasecloudmessaging.admin` | API account | project |
| `roles/secretmanager.secretAccessor` | API account | each of the 15 secrets named above |
| `roles/storage.objectUser` | API account | `gs://srsbbucket` |
| `roles/cloudtasks.enqueuer` | API account | queues `resume-processing` and `whatsapp-notifications` |
| `roles/iam.serviceAccountUser` | `github-deploy-dev` | both new service accounts |
| `roles/iam.serviceAccountUser` | `service-601892050765@serverless-robot-prod.iam.gserviceaccount.com` | both new service accounts |

Leave in place until the smoke tests pass: project `roles/editor` and the other Compute Engine project roles, the Compute Engine bucket binding, `allUsers`, the owner, and every Firebase Admin SDK role. The Firebase account's project `roles/iam.serviceAccountTokenCreator` lets it sign as other accounts in the project. That is a separate approval. This plan does not remove it. The Firebase account's bucket `roles/storage.objectAdmin` is also left for that review. The app's storage client does not use that account.

Remove, only after the new API revision is healthy and only from the Compute Engine account:

1. Bucket `roles/storage.objectAdmin` for `601892050765-compute@...` on `gs://srsbbucket`.
2. Project `roles/storage.objectAdmin`.
3. Project `roles/secretmanager.secretAccessor`.
4. Project `roles/documentai.apiUser` for the Compute Engine account only.
5. Project `roles/cloudsql.client`.
6. Project `roles/editor` last.

Do not delete the Compute Engine service account. `github-deploy-dev` can keep `roles/iam.serviceAccountUser` on it so a rollback revision can use it.

If `roles/storage.objectUser` fails an upload or delete, the approved fallback is `roles/storage.objectAdmin` on `gs://srsbbucket` for the API account only. That is still not project editor.

### Staged sequence

1. Approval of this section. No Terraform apply. The security-branch DEV root is only a locals stub, and live bindings were created outside it. A new `infrastructure/terraform/environments/dev/runtime-iam.tf` can adopt these accounts later, after an import plan. Do not add that file to the uncommitted PROD root in the original checkout, and do not let a stub root create duplicate bindings.
2. Create the two accounts and add the roles in the table above. The Compute Engine account still has editor.
3. `gcloud run services update careerbridge-api-dev --service-account=careerbridge-api-runtime-dev@careerbridge-f7b72.iam.gserviceaccount.com --region=asia-south1 --project=careerbridge-f7b72`. Do not change the image. Traffic moves only if the new revision becomes ready. Secret access is checked before the process starts.
4. Run the API smoke tests below.
5. Repeat the service-account update for `careerbridge-web-dev` with the web account. Do not change its image.
6. Run the web smoke tests.
7. Remove the Compute Engine roles in the order above, with a health check between each removal.

`deploy-dev.yml` updates only the image. The next deploy keeps the service account already on the service. It fails unless `github-deploy-dev` has `roles/iam.serviceAccountUser` on that account. That grant is step 2.

### Role validation

`gcloud iam roles describe` on 2026-10-13 supplied the permission lists below. No binding was changed.

| Role | Who | Narrowest scope | Necessary and sufficient |
|---|---|---|---|
| `roles/logging.logWriter` | API account and web account | project. Log entries are not a Cloud Run resource | Yes. The included permissions are `logging.logEntries.create` and `logging.logEntries.route`. The processes write stdout and do not call another logging method |
| `roles/monitoring.metricWriter` | neither | — | No. Nothing in `apps/api` or `apps/web` creates a metric descriptor or time series. Built-in Cloud Run metrics are not written by the runtime account. Do not grant it |
| `roles/cloudsql.client` | API account only | instance `careerbridge-dev-db` | Yes for the socket. The included permissions are `cloudsql.instances.connect` and `cloudsql.instances.get`. `docker-entrypoint.sh` builds `DATABASE_URL` from `DATABASE_USER`, `DATABASE_NAME`, `DATABASE_HOST`, and `DB_PASSWORD`. That is password auth through the Cloud SQL socket, not IAM database login. The web service does not connect |
| `roles/documentai.apiUser` | API account only | the processor named by `DOCUMENT_AI_PROCESSOR_ID` in `asia-south1` | Sufficient for `processDocument`. The code calls `processOnline`. The role also includes batch processing and human review, which this code does not call. No narrower predefined role was found. Processor IAM was not read in this pass |
| `roles/firebasecloudmessaging.admin` | API account only | project. This role has no smaller resource | Necessary for `sendEachForMulticast`, which `notifications.service.ts` calls for stored device tokens. The required permission is `cloudmessaging.messages.create`. The role also manages topic subscriptions and delivery data, which this code does not use. `verifyIdToken` does not need it. The web service does not call the Admin SDK |
| `roles/secretmanager.secretAccessor` | API account only | each secret below | Yes. The included secret permission is `secretmanager.versions.access`. The process does not call Secret Manager. Cloud Run uses the runtime account to resolve the mounted versions. The web service mounts none |
| `roles/storage.objectUser` | API account only | `gs://srsbbucket` | Sufficient for the current object calls: `file.save` (`resumable: false`), `download`, and `delete`. Those need `storage.objects.create`, `get`, `update`, and `delete`, which this role includes. It does not include `storage.buckets.get`, `storage.objects.setIamPolicy`, or `iam.serviceAccounts.signBlob`. No caller sets `isPublic: true`. `getSignedUrl` fails without `signBlob`, and `readableResumeUrl` then downloads the object. That fallback is the current path. Whether the Storage client also calls `buckets.get` is unresolved until the synthetic upload |
| `roles/cloudtasks.enqueuer` | API account only | queue `resume-processing` and queue `whatsapp-notifications` | Yes for `createTask`. The included task permissions are `cloudtasks.tasks.create`, `cloudtasks.tasks.fullView`, and `cloudtasks.operations.get`. The code does not update queues. Both HTTP tasks set a shared-secret header and do not set `oidcToken`. Callbacks stay on the existing `allUsers` invoker. This plan does not add a second public path |
| `roles/iam.serviceAccountUser` | `github-deploy-dev`, and the Cloud Run service agent `service-601892050765@serverless-robot-prod.iam.gserviceaccount.com` | each new runtime service account | Yes for deployment, not for request handling. The included permission that deploy uses is `iam.serviceAccounts.actAs`. `deploy-dev.yml` only updates the image, and Cloud Run refuses a user-managed runtime account unless the service agent can act as it. The Compute Engine account's resource policy lists `serviceAccountUser` for `github-deploy-dev` only. The service agent's own project bindings were not re-read in this validation pass. The default Compute Engine account does not need that service-agent binding; a new account does. `github-deploy-dev` already has service `roles/run.developer` and repository `roles/artifactregistry.writer`. Those stay. The runtime accounts do not need either role |

Secret env var to Secret Manager resource, values not read:

| Env var | Secret | Version |
|---|---|---|
| `DB_PASSWORD` | `careerbridge-db-password` | `latest` |
| `GEMINI_API_KEY` | `careerbridge-gemini-api-key` | `latest` |
| `WHATSAPP_ACCESS_TOKEN` | `careerbridge-whatsapp-access-token` | `latest` |
| `WHATSAPP_VERIFY_TOKEN` | `careerbridge-whatsapp-verify-token` | `latest` |
| `WHATSAPP_PHONE_NUMBER_ID` | `careerbridge-whatsapp-phone-number-id` | `latest` |
| `WHATSAPP_TASK_SECRET` | `careerbridge-whatsapp-task-secret` | `latest` |
| `JWT_ACCESS_SECRET` | `careerbridge-jwt-access-secret` | `latest` |
| `JWT_REFRESH_SECRET` | `careerbridge-jwt-refresh-secret` | `latest` |
| `RESUME_TASK_SECRET` | `careerbridge-resume-task-secret` | `latest` |
| `GSTINAPI_KEY` | `careerbridge-gstinapi-key` | `latest` |
| `SMTP_USER` | `careerbridge-smtp-support-user` | `latest` |
| `SMTP_PASS` | `careerbridge-smtp-support-pass` | `latest` |
| `WHATSAPP_APP_SECRET` | `careerbridge-whatsapp-app-secret` | `latest` |
| `PII_ENCRYPTION_KEYS` | `careerbridge-pii-encryption-keys` | `1` |
| `PII_LOOKUP_KEY` | `careerbridge-pii-lookup-key` | `1` |

Gemini uses `GEMINI_API_KEY`. It does not need a Vertex AI role.

Safe checks, without customer rows:

- Logs: the new revision becomes ready and its startup line is visible. Do not grant metric writer to test this.
- Cloud SQL: readiness plus `GET /api/v1/health`. Do not open a SQL client and do not select candidate or employer tables. `prisma migrate deploy` on an already-current DEV schema is the startup connection.
- Document AI: one synthetic one-page PDF through the API account. No customer resume.
- FCM: one synthetic invalid device token. Expect an invalid-token result. Do not read or use stored customer tokens.
- Secrets: the API revision starts. Do not print the resolved values. The web revision has no secret mounts.
- Storage: a synthetic candidate uploads, downloads, and deletes one object. Confirm the signed-URL attempt falls back to a download. If upload fails on `storage.buckets.get`, grant bucket `roles/storage.objectAdmin` to the API account only.
- Cloud Tasks: enqueue resume processing for that synthetic resume and confirm the log says the task was created. Do not enqueue a WhatsApp task to a real number. A callback without the task secret, and one with the wrong secret, must be rejected.
- Deploy: `github-deploy-dev` can update the image only after it has `serviceAccountUser` on the runtime account. This plan does not run that deploy.

### Smoke tests and rollback

Record, before any switch: API revision `careerbridge-api-dev-00084-8xb` and web revision `careerbridge-web-dev-00067-ctj`, both on `601892050765-compute@developer.gserviceaccount.com`. Do not remove `roles/editor` before the smoke tests pass.

1. Create the two accounts and add every grant in the table above, including service-agent `serviceAccountUser`. Leave the Compute Engine grants in place.
2. Switch only the API service account, without changing its image. Wait until the new revision is ready and has 100% traffic. `GET /api/v1/health` must succeed. Run the API checks above.
3. If that revision is not ready or a check fails, send 100% traffic back to `careerbridge-api-dev-00084-8xb`, then set the service account back to the Compute Engine account so the next revision does not keep the failed identity. Do not remove any Compute Engine role. The new account's grants can stay; they are unused while the service runs as the Compute Engine account.
4. Switch only the web service account, without changing its image. `GET /` must succeed without a Google identity token.
5. If the web revision fails, send 100% traffic back to `careerbridge-web-dev-00067-ctj` and set the web service account back to the Compute Engine account.
6. After both new revisions pass, remove Compute Engine access in this order, with a health check after each removal: bucket `roles/storage.objectAdmin` on `gs://srsbbucket`, project `roles/storage.objectAdmin`, project `roles/secretmanager.secretAccessor`, project `roles/documentai.apiUser` for the Compute Engine account only, project `roles/cloudsql.client`, and project `roles/editor` last. `roles/editor` is a separate final change. Do not combine it with the service-account switch.
7. Keep `github-deploy-dev`'s `serviceAccountUser` grant on the Compute Engine account until that final editor removal has been healthy. Then it can be removed only if no rollback revision still uses that account. Do not delete the Compute Engine account.
8. The new accounts' grants are the replacement set, not temporary grants. Remove one only if a smoke test shows it is unused. Do not remove `roles/logging.logWriter`, the API data roles, or either `serviceAccountUser` grant as part of cleanup.

After `roles/editor` is gone, traffic rollback to `00084-8xb` or `00067-ctj` also requires those removed Compute Engine roles to be restored before the old revisions can use SQL, secrets, storage, and tasks.

### Decisions that need approval

- Create the two runtime accounts and apply the adds and removals above.
- Keep `allUsers` on both services.
- Leave the Firebase Admin SDK project roles, including project `roles/iam.serviceAccountTokenCreator`, for a separate review.
- Do not grant the API account `roles/iam.serviceAccountTokenCreator` unless signed URLs are chosen to replace the inline-download fallback.
- Accept `roles/firebasecloudmessaging.admin` for the API account, or confirm DEV does not send FCM and omit it.
- Adopt Terraform only with an import plan. Do not apply the stub DEV root or the PROD root.

Status of this plan: **IAM matrix verified for review**. The role list above replaces the earlier metric-writer grant. Section 19, re-checked later the same day, withdraws the Cloud Run service-agent `serviceAccountUser` grant for these same-project identities and closes the storage, Cloud SQL, and Document AI scope questions. Nothing in section 18 or 19 is applied.

## 19. DEV runtime identity migration preparation (not applied)

Date: 2026-10-13, later the same day. Read-only re-check of project `careerbridge-f7b72`, region `asia-south1`. Every gcloud command set `--project=careerbridge-f7b72` explicitly. No service account, IAM binding, Cloud Run revision, secret, bucket, queue, database, or API was created or changed. Secret values were not read. No object was uploaded or deleted. Terraform was not planned or applied.

This section is the implementation plan. It does not combine the identity switch with a public-invoker change, a dependency change, or removal of `roles/editor`.

### Re-verified current state

| Resource | Ready revision | Traffic | Ingress | Image | Runtime identity |
|---|---|---|---|---|---|
| `careerbridge-api-dev` | `careerbridge-api-dev-00084-8xb` | 100% latest | `all` | `api:d014a4585a813417efa4967da3f4e3c900aa70ae` digest `api@sha256:b3bae4876cf1465b45b7668f813a75e7b4722ba18875b723cecc3b0608b23fdd` | `601892050765-compute@developer.gserviceaccount.com` |
| `careerbridge-web-dev` | `careerbridge-web-dev-00067-ctj` | 100% latest | `all` | `web:d014a4585a813417efa4967da3f4e3c900aa70ae` digest `web@sha256:082ed356c869ae8cc06781154253f0d93dd8d74f3ba1a604a69b8a19fafa9016` | same Compute Engine account |

Cloud SQL annotation on the API template: `careerbridge-f7b72:asia-south1:careerbridge-dev-db`. Instance `careerbridge-dev-db` is PostgreSQL 16 in `asia-south1`. `gcloud sql instances get-iam-policy` is not a command in the installed gcloud, so the instance has no separate IAM policy surface here. `DATABASE_HOST` is the Cloud SQL socket `/cloudsql/careerbridge-f7b72:asia-south1:careerbridge-dev-db`. The web service still has only `NODE_ENV`, `HOSTNAME`, `NEXT_TELEMETRY_DISABLED`, and `API_INTERNAL_URL`.

Project bindings for the Compute Engine account are unchanged: `roles/editor`, `roles/cloudsql.client`, `roles/documentai.apiUser`, `roles/secretmanager.secretAccessor`, and `roles/storage.objectAdmin`. `github-deploy-dev@careerbridge-f7b72.iam.gserviceaccount.com` still has no project role. The Cloud Run service agent `service-601892050765@serverless-robot-prod.iam.gserviceaccount.com` has project `roles/run.serviceAgent`. That role includes `iam.serviceAccounts.actAs`, `iam.serviceAccounts.getAccessToken`, `iam.serviceAccounts.getOpenIdToken`, and `iam.serviceAccounts.signBlob`, plus Artifact Registry download. The Compute Engine account's own policy still grants `roles/iam.serviceAccountUser` only to `github-deploy-dev`.

Both Cloud Run services still grant `allUsers` `roles/run.invoker` and `github-deploy-dev` `roles/run.developer`. Artifact Registry repository `careerbridge-dev` in `asia-south1` still grants `github-deploy-dev` `roles/artifactregistry.writer`.

Queues `resume-processing` and `whatsapp-notifications` are `RUNNING` in `asia-south1`. Both queue IAM policies are empty. `cloud-tasks.service.ts` calls `createTask` with `X-Resume-Task-Secret` or `X-WhatsApp-Task-Secret` and does not set `oidcToken`. Callbacks therefore depend on the existing `allUsers` invoker plus the shared-secret header.

`gs://srsbbucket` is in `ASIA-SOUTH1`, with uniform bucket-level access and public access prevention enforced. Bucket `roles/storage.objectAdmin` is held by the Compute Engine account, `firebase-adminsdk-fbsvc@careerbridge-f7b72.iam.gserviceaccount.com`, and `user:srsbhr25@gmail.com`. Legacy bucket owners remain `project-a1ebc83d-dd51-48f2-97d`. Project `roles/storage.objectAdmin` does not cover this bucket.

Eight secrets already grant resource `roles/secretmanager.secretAccessor` to the Compute Engine account: `careerbridge-gemini-api-key`, `careerbridge-whatsapp-access-token`, `careerbridge-whatsapp-verify-token`, `careerbridge-whatsapp-phone-number-id`, `careerbridge-whatsapp-task-secret`, `careerbridge-jwt-access-secret`, `careerbridge-jwt-refresh-secret`, and `careerbridge-resume-task-secret`. These seven have no resource policy and are reached only through the project role: `careerbridge-db-password`, `careerbridge-gstinapi-key`, `careerbridge-smtp-support-user`, `careerbridge-smtp-support-pass`, `careerbridge-whatsapp-app-secret`, `careerbridge-pii-encryption-keys`, and `careerbridge-pii-lookup-key`. Versions are unchanged from section 18. Values were not read.

### Proposed identities

Do not create these until a separate approval:

- API: `careerbridge-api-runtime-dev@careerbridge-f7b72.iam.gserviceaccount.com`
- Web: `careerbridge-web-runtime-dev@careerbridge-f7b72.iam.gserviceaccount.com`

| Role | Principal | Scope | Why this scope |
|---|---|---|---|
| `roles/logging.logWriter` | both | project `careerbridge-f7b72` | `logging.logEntries.create` and `logging.logEntries.route`. No smaller log resource |
| `roles/cloudsql.client` | API | project binding conditioned on `resource.name == 'projects/careerbridge-f7b72/instances/careerbridge-dev-db' && resource.service == 'sqladmin.googleapis.com'` | Google documents this condition as the way to limit `cloudsql.instances.connect` and `cloudsql.instances.get` to one instance. The installed gcloud has no instance IAM policy command, and the role's lowest listed resource is the project. An unconditional project grant is broader than this condition |
| `roles/documentai.apiUser` | API | project `careerbridge-f7b72` | Live processor `CareerBridgeOCR` is `OCR_PROCESSOR` and `ENABLED` in `asia-south1`. The client calls v1 `ProcessDocument`, which requires `documentai.processors.processOnline` on that processor. That permission is testable on the processor resource. `list-grantable-roles` returned `INVALID_ARGUMENT`, so a processor-level role binding is not verified. Project scope is the narrowest verified grant. The Compute Engine account already has this role on the project |
| `roles/firebasecloudmessaging.admin` | API | project | `cloudmessaging.messages.create` is present and is what `sendEachForMulticast` needs. No narrower predefined role was found. `verifyIdToken` does not need it |
| `roles/secretmanager.secretAccessor` | API | each of the 15 secrets in section 18 | `secretmanager.versions.access`. Cloud Run resolves the mounts. The web service has none |
| `roles/storage.objectUser` | API | `gs://srsbbucket` | See the storage resolution below. The role also contains `monitoring.timeSeries.create`. That is not a reason to add `roles/monitoring.metricWriter` |
| `roles/cloudtasks.enqueuer` | API | queues `resume-processing` and `whatsapp-notifications` | `cloudtasks.tasks.create`, `cloudtasks.tasks.fullView`, and `cloudtasks.operations.get` |
| `roles/iam.serviceAccountUser` | `github-deploy-dev` | both new service accounts | Required to attach either identity. The deployer does not have this on any account except the Compute Engine account today |

The web account gets `roles/logging.logWriter` only. It does not get Cloud SQL, Document AI, Firebase, Secret Manager, Storage, Cloud Tasks, metric writer, or editor.

Do not grant `roles/monitoring.metricWriter`. Do not grant the API account `roles/iam.serviceAccountTokenCreator`. Do not grant the Cloud Run service agent `roles/iam.serviceAccountUser` or `roles/iam.serviceAccountTokenCreator` on these accounts. Current Cloud Run service-identity documentation requires the deployer to have `roles/iam.serviceAccountUser` on a same-project runtime identity. It requires Token Creator on the service agent only when the runtime identity is in a different project. Both proposed accounts are in `careerbridge-f7b72`, and the service agent already has project `roles/run.serviceAgent`.

`github-deploy-dev` already has `roles/run.developer` on both services and `roles/artifactregistry.writer` on `careerbridge-dev`. The service agent role already includes Artifact Registry download. No new repository or Cloud Run role is required. `.github/workflows/deploy-dev.yml` runs `gcloud run services update --image` and does not set `--service-account`. After the identity is attached, the next image deploy keeps it and fails unless `github-deploy-dev` can act as that identity. Keep the deployer's existing `serviceAccountUser` grant on the Compute Engine account until no rollback revision still uses it.

### Cloud Storage

`@google-cloud/storage` `7.22.0` is locked in `origin/dev` `package-lock.json` and in this worktree. The live images were built from `origin/dev`. Application calls are `file.save` with `resumable: false` and optional custom metadata, `download`, `delete({ ignoreNotFound: true })`, and v4 `getSignedUrl`. No caller passes `isPublic: true`. The application does not call `bucket.exists`, `bucket.get`, or `file.getMetadata`.

| Operation | Code path in 7.22.0 | Permission | Covered by `roles/storage.objectUser` |
|---|---|---|---|
| Upload a new object, including custom metadata | `File#save` → `createWriteStream` → `startSimpleUpload_` POSTs `/upload/storage/v1/b/{bucket}/o` | `storage.objects.create` | Yes |
| Download an existing object | `File#download` → `createReadStream` | `storage.objects.get` | Yes |
| Delete that object, including a missing object | `File#delete` is Objects: delete. `ignoreNotFound` only swallows a 404 from that delete | `storage.objects.delete` | Yes |
| Metadata returned by the upload | Integrity validation reads `this.metadata` from the upload response. It does not call `buckets.get` or `objects.get` | Included in the create response | Yes |
| Signed URL | `File#getSignedUrl` → `URLSigner`, which calls `authClient.sign`. On Cloud Run ADC that is IAM `signBlob` | `iam.serviceAccounts.signBlob` | No. `readableResumeUrl` catches the failure and `downloadFile` returns the bytes. Do not add Token Creator for this migration |
| `storage.buckets.get` | Not called by `save`, `download`, `delete`, upload integrity, or `getSignedUrl` | None for the current path | Not required. Do not grant it unless a later probe returns 403 naming that permission |

### Storage probe, after separate approval

Do not run this until the API account exists. Do not use the Compute Engine account. Do not read, overwrite, or delete any object outside `_iam-probe/`.

1. As `careerbridge-api-runtime-dev`, create one object named `_iam-probe/<uuid>.txt` whose body is a fixed non-customer marker.
2. Download that exact object and compare the bytes to the marker.
3. The application does not call `file.getMetadata`. The probe still reads metadata for that same object once, because upload custom metadata is stored on the object and a metadata 403 would show a gap the library path did not predict.
4. Delete only `_iam-probe/<uuid>.txt`.
5. List `_iam-probe/` and confirm that object is gone. Report the status of create, read, metadata, delete, and the list. Leave the prefix empty.
6. Optionally call `getSignedUrl` on the object before deletion. Failure is the expected result. Success is not required.
7. Stop if create, read, or delete returns 403 naming `storage.buckets.get`. The missing permission is `storage.buckets.get` on `gs://srsbbucket` only. Do not grant `roles/storage.objectAdmin` for that failure.

### Terraform ownership

This worktree's Terraform has no `resource` blocks. `environments/dev/main.tf` only sets `project_id = "careerbridge-dev"`. That is not `careerbridge-f7b72`. The stub modules under `infrastructure/terraform/modules/` declare variables only. The DEV runtime accounts, IAM bindings, Cloud Run services, secrets, bucket, queues, and Cloud SQL instance are not managed here. gcloud is the authoritative configuration for the identity migration.

`environments/prod/main.tf` in this worktree sets `project_id = "careerbridge-prod"`. `environments/staging/main.tf` sets `careerbridge-staging`. Neither is a live root for this migration. Do not edit the PROD root. Do not create a new root in this task.

Before Terraform can own the proposed identities, a DEV root must target `careerbridge-f7b72` and import each object it will manage. Use additive members only: `google_service_account`, `google_project_iam_member`, `google_secret_manager_secret_iam_member`, `google_storage_bucket_iam_member`, `google_cloud_tasks_queue_iam_member`, and `google_service_account_iam_member`. Do not use `google_project_iam_policy`, `google_storage_bucket_iam_policy`, `google_secret_manager_secret_iam_policy`, or `google_cloud_tasks_queue_iam_policy`. Those resources replace the whole policy and would drop the owner, `allUsers`, the Firebase Admin SDK bindings, and the Compute Engine bindings. Do not import the Cloud Run services into the current modules. Those modules cannot represent the live services, so Terraform would not own their service-account field. Until that import exists, implement the migration with gcloud and do not apply this stub.

### Ordered change plan

1. Confirm this section. Terraform does not own the live resources. Implementation uses gcloud until an import plan exists.
2. After a separate approval, create only the two runtime accounts. Attach nothing yet.
3. Add only the grants in the table above. Leave every Compute Engine grant, both `allUsers` invokers, the owner, and the Firebase Admin SDK roles in place.
4. Verify without reading secret values: each new account exists; `gcloud projects get-iam-policy` shows the conditional Cloud SQL binding, project log writer, project Document AI, and project FCM; each of the 15 secrets lists the API account as `secretAccessor`; the bucket lists the API account as `objectUser`; both queues list the API account as `enqueuer`; both new accounts list `github-deploy-dev` as `serviceAccountUser`. The web account has no other role.
5. Update only `careerbridge-api-dev` to the API account. Do not change its image, ingress, invoker, env, or secrets. The new revision must become ready at 100% traffic.
6. Run the API smoke tests below on synthetic data.
7. Update only `careerbridge-web-dev` to the web account. Do not change its image or invoker.
8. Run the public website and browser-to-API smoke tests.
9. Review API and web logs, Cloud SQL connection errors, Document AI errors, storage 403s, and Cloud Tasks dispatch. A task callback must still present the shared-secret header. Do not add OIDC in this change.
10. Leave `roles/editor` on the Compute Engine account until both new revisions pass.
11. Remove `roles/editor`, and the other Compute Engine data roles, only as a later explicitly approved change after a check that no remaining workload still runs as that account. In that later change, also remove the eight secret-level Compute Engine `secretAccessor` bindings and the bucket `objectAdmin` binding. Removing the project role alone leaves those eight secrets and the bucket reachable.

`deploy-dev.yml` is not the vehicle for step 5 or 7. It does not set the service account. A later image deploy may keep the new identity, but this migration itself does not ship the uncommitted security fixes or a new image.

### Smoke tests

Use synthetic users and one synthetic file. Do not send a WhatsApp message to a real number. Do not print secret values. These tests exercise the current live image after the identity switch. They do not prove the uncommitted fail-closed task checks, which are not in `d014a458`.

- Web: unauthenticated `GET /` returns 200, matching `deploy-dev.yml`.
- API: unauthenticated `GET /api/v1/health` matches the deploy check `.data.status == "ok"`. The revision is ready and startup logs are present.
- Auth: synthetic candidate and employer registration, login, refresh, and logout. A wrong password is rejected. Logout invalidates the refresh token used in the test.
- Workflows: the synthetic candidate can open the candidate surface, and the synthetic employer can open the employer surface. Each receives 401 or 403 on the other's protected record.
- Resume: the candidate uploads one small synthetic PDF, downloads it, and deletes it. A second synthetic user receives 403 or 404 for that object. The signed-URL attempt may fail and the download fallback must still return the bytes.
- Document AI: process that same synthetic PDF. Expect a parsed result or a documented processor error, not `PERMISSION_DENIED`.
- Secrets: the API revision reaches ready. A missing mount would fail before the process listens. Do not resolve or log the values.
- Cloud Tasks: enqueue resume processing for the synthetic resume and confirm a task create log for `resume-processing`. The worker callback without the header, and one with the wrong header, must not process another user's resume. On the current live image an empty expected secret still fails open, so this migration does not treat an empty-secret callback as a pass. Do not enqueue `whatsapp-notifications` to a real number. A queue-permission check is a create against `whatsapp-notifications` only if the target URL is a non-delivering test hook approved at implementation time; otherwise confirm `enqueuer` with `gcloud tasks queues get-iam-policy` and skip the live WhatsApp enqueue.

### Task authentication, live versus this worktree

`origin/dev` is `d014a4585a813417efa4967da3f4e3c900aa70ae`. That is the commit in the running API image. This worktree is `567d544` plus uncommitted security fixes, and those fixes are not deployed.

Both versions enqueue to `resume-processing` and `whatsapp-notifications`. Resume tasks set `X-Resume-Task-Secret` only when the secret is non-empty. WhatsApp tasks always set `X-WhatsApp-Task-Secret`, which can be an empty string. Neither version sets `oidcToken`.

Deployed `origin/dev` checks `if (expected && providedSecret !== expected)` for the resume worker and `if (expected && secret !== expected)` for `POST /api/v1/whatsapp/tasks/run`. An empty expected secret allows the callback. A wrong non-empty secret is rejected.

Uncommitted `cloudTaskSecretStatus` treats an empty expected secret as `missing_secret` when `NODE_ENV` is `production` or `GCP_PROJECT_ID` is set, and both handlers then return 403. That behavior is not in the live image.

Residual risk, preserved for this migration: callbacks are unauthenticated HTTP plus a shared header, and both services remain publicly invokable. This migration does not add OIDC and does not remove `allUsers`. It also does not deploy the fail-closed check. Production deployment of the application remains a separate decision.

### Rollback

Record, before step 5, the revisions and digests in the table above and the Compute Engine identity. A traffic rollback does not restore an IAM binding that was removed. This migration does not remove Compute Engine bindings, so the identity rollback below is sufficient until step 11.

1. If the API revision is not ready or a smoke test fails, move 100% API traffic back to `careerbridge-api-dev-00084-8xb`, then set `careerbridge-api-dev` service account back to `601892050765-compute@developer.gserviceaccount.com`. Confirm that revision still has its original digest and that `GET /api/v1/health` succeeds.
2. If the web revision fails, move 100% web traffic back to `careerbridge-web-dev-00067-ctj`, set the web service account back to the same Compute Engine account, and confirm `GET /` returns 200.
3. The new accounts and their grants may stay while unused. Do not delete them as part of rollback.
4. After step 11 has removed Compute Engine roles, traffic rollback is not enough. Restore project `roles/editor`, `roles/cloudsql.client`, `roles/documentai.apiUser`, and `roles/secretmanager.secretAccessor` to the Compute Engine account, restore bucket `roles/storage.objectAdmin`, and restore the eight secret-level `secretAccessor` bindings before expecting `00084-8xb` to use SQL, secrets, storage, or tasks. Then repeat the health checks.

### Go / no-go

| Item | Evidence | Finding | Risk if left as-is | Next action | Identity migration | Production deployment | Class |
|---|---|---|---|---|---|---|---|
| Document AI permission | `resume-extractor.service.ts`; `@google-cloud/documentai` 9.6.2 v1 proto `ProcessDocument`; live processor `CareerBridgeOCR` `ENABLED`; `list-testable-permissions` returned `documentai.processors.processOnline` | The call needs `documentai.processors.processOnline` on `projects/careerbridge-f7b72/locations/asia-south1/processors/<CareerBridgeOCR>` | A project grant is broader than one processor | Grant project `roles/documentai.apiUser` to the API account | Does not block | Does not block the identity change. App deployment stays separate | VERIFIED |
| Processor-level role binding | `gcloud iam list-grantable-roles` on that processor resource returned `INVALID_ARGUMENT`. `gcloud documentai` is not installed. The global `:getIamPolicy` 404 used `documentai.googleapis.com`, not the regional host the client uses | A processor-scoped `roles/documentai.apiUser` binding was not verified | None for this migration, because the grant is project-scoped | Retry processor IAM only if a later change wants the narrower binding | Does not block | Does not block | UNRESOLVED — NON-BLOCKING |
| Storage operations | Library 7.22.0 `save`, `download`, `delete`, and `getSignedUrl`; role permissions from `gcloud iam roles describe roles/storage.objectUser` | `objectUser` covers create, get, and delete. The path does not call `storage.buckets.get`. Signed URLs need `signBlob` and already fall back to download | A live 403 could still appear if the service behaves differently from this library path | Run the `_iam-probe/` probe after the API account exists and before editor removal | Does not block the grant or the identity switch | Does not block this migration. The probe is part of implementation, not a reason to grant a wider role now | VERIFIED for the grant. The unrun probe is UNRESOLVED — NON-BLOCKING |
| Terraform ownership | This worktree's `environments/dev/main.tf` and modules. No `resource` blocks. `project_id` is `careerbridge-dev` | Terraform does not own the live identities or bindings, and this root targets the wrong project | Applying the stub would not manage DEV, or could target the wrong project | Implement with gcloud. Import only into a future root that targets `careerbridge-f7b72` and uses additive IAM members | Does not block a gcloud implementation. Blocks a Terraform apply | Blocks any Terraform-driven production apply from this root | VERIFIED |
| Deployer permissions | Live policies: `github-deploy-dev` has `roles/run.developer` on both services, `roles/artifactregistry.writer` on `careerbridge-dev`, and `roles/iam.serviceAccountUser` only on the Compute Engine account. Service agent has project `roles/run.serviceAgent` | The deployer needs `roles/iam.serviceAccountUser` on each new account. Artifact Registry writer and Cloud Run developer are already sufficient. No additional service-agent binding is required for these same-project accounts | The service-account update fails without the deployer `actAs` grant | Add that one role on each new account before the Cloud Run update | Does not block approval. It is an implementation step | Does not block | VERIFIED |
| Task callbacks | `origin/dev` at `d014a458` versus uncommitted `task-secret.ts`. Live queues have empty IAM and no OIDC in either source | Live code fails open when the expected secret is empty. The uncommitted code fails closed. Neither sends OIDC | Public worker URLs accept a callback when the live secret check is skipped | Keep the identity migration on the current image. Ship the fail-closed code in a separate release. Do not send WhatsApp to a real number | Does not block | Blocks production deployment of the application until the fail-closed code is what is deployed and tested | VERIFIED as a difference. The fail-closed gap is BLOCKING for production deployment only |
| Editor removal and the storage probe | Section 19 steps 10 and 11 | Editor stays until both services pass, including the storage probe | Removing editor first strands rollback | Keep editor until that separate approval | Does not block the identity switch | Blocks production hardening, not this migration | UNRESOLVED — NON-BLOCKING |

Firebase Admin SDK project roles and its bucket `objectAdmin` binding stay out of this change.

Status of the plan: ready for implementation review as of the planning pass. The implementation attempt on 2026-10-13 stopped at preflight. See the checkpoint below.

### Implementation checkpoint — 2026-10-13 preflight stop

Branch `security/dev-remediation` at `567d544` in `C:\Users\ADMIN\Desktop\CareerBridge-security`. No service account, IAM binding, Cloud Run revision, or database setting was changed.

Revisions still match the review: API `careerbridge-api-dev-00084-8xb` at 100% traffic, digest `api@sha256:b3bae4876cf1465b45b7668f813a75e7b4722ba18875b723cecc3b0608b23fdd`, identity `601892050765-compute@developer.gserviceaccount.com`. Web `careerbridge-web-dev-00067-ctj` at 100% traffic, digest `web@sha256:082ed356c869ae8cc06781154253f0d93dd8d74f3ba1a604a69b8a19fafa9016`, same identity. Ingress remains `all`. Both dedicated runtime accounts are absent. Project `roles/editor` remains on the Compute Engine account. The 15 secret mounts, processor `CareerBridgeOCR` (`ENABLED`), bucket `objectAdmin` for the Compute Engine account, and both empty queue policies match the review.

Material difference: Cloud SQL `careerbridge-dev-db` is `state=STOPPED` and `settings.activationPolicy=NEVER`. The reviewed plan treated that instance as the API's startup database. `GET https://careerbridge-api-dev-yo5h6bqrha-el.a.run.app/api/v1/health` returned HTTP 503. The web root returned HTTP 200. A new API revision runs `prisma migrate deploy` and would not become a healthy replacement while the instance is stopped. Starting the instance would change a database resource, which this migration does not authorize.

No rollback was required. `roles/editor` was not removed.

Implementation status: **BLOCKED** until `careerbridge-dev-db` is running under a separate approval and the current API health check succeeds. Then re-run this preflight before creating the runtime accounts.

## 20. Production isolation verification

Date: 2026-10-13. Worktree `C:\Users\ADMIN\Desktop\CareerBridge-security`, branch `security/dev-remediation`, HEAD `567d544e5f6dab0cde3dce50e164d0edb7d6b8ca`. The branch tracks `origin/dev` and is one commit behind it: `d014a45` (web navbar only). That commit was not merged. No commit, push, deploy, Terraform apply, API enablement, IAM change, DNS change, secret creation, or Cloud Build. The checkout at `C:\Users\ADMIN\Desktop\CareerBridge` was not edited.

### Audits

`npm audit --omit=dev --json` exit 1: critical=0, high=4, moderate=14, low=2, total=20.

`npm audit --json` exit 1: critical=0, high=17, moderate=19, low=5, total=41.

The four production highs are still one chain. npm's only fix is `firebase@9.14.0` (`isSemVerMajor: true`). That downgrade was not applied, and no `@grpc/grpc-js` override was added.

| Package | Installed | Path | Advisory |
|---|---|---|---|
| `@grpc/grpc-js` | 1.9.16 | `node_modules/@grpc/grpc-js`, required by `@firebase/firestore@4.8.0` via `~1.9.0` | [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) high, range `<1.13.6`. [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4) low, same range |
| `@firebase/firestore` | 4.8.0 | `node_modules/@firebase/firestore` | High only through that gRPC package |
| `@firebase/firestore-compat` | pulled with `firebase@11.10.0` | `node_modules/@firebase/firestore-compat` | High only through Firestore |
| `firebase` | 11.10.0 | `node_modules/firebase` | High only through Firestore |

`npm ls` also shows API-side copies that are outside the vulnerable range: `@grpc/grpc-js@1.14.5` and `@grpc/grpc-js@1.14.6`. The section 16 exception stands. A compatible Firebase 11, 12, or 13 upgrade was not found in that section, and this pass did not introduce one.

The other 13 full-audit highs are the same dev-tool chain (`@nestjs/cli`, `eslint-config-next`, `braces`, `chokidar`, `deepmerge-ts`, `fast-glob`, `micromatch`, `picomatch`, `prisma` / `@prisma/config`, `tmp`, and related packages). Their suggested fixes are major downgrades or Nest CLI 12. They were not applied.

### Application checks

`cloudTaskSecretStatus` still rejects a missing, empty, or whitespace-only secret when `NODE_ENV` is `production` or `GCP_PROJECT_ID` is set, and rejects a missing, empty, or different header when a secret is configured. Resume worker and WhatsApp task callback both use it. The unit test covers those cases.

Resume uploads stay on `ResumesController`, which requires `Roles(CANDIDATE)`. Multer size and unexpected-field errors still map to 413 and 400. `ParseResumeController` is a different route. It has no `@Public()` and no `@Roles()`, so any active account can call it. The web app does not call that route from a candidate-only or employer-only screen; the Next proxy only forwards `Authorization`. No role was added, because the existing product behavior does not establish one.

`resolveGcsBucket` now throws when `GCS_BUCKET` is empty in production or on Cloud Run. Local development without `GCP_PROJECT_ID` still defaults to `srsbbucket`. Live DEV sets `GCS_BUCKET=srsbbucket` explicitly, so this does not change that service. A production process cannot silently adopt that bucket.

### Production build path

`infrastructure/cloudbuild.web.yaml` remains the DEV build file. It bakes the DEV API host and Firebase project `careerbridge-f7b72`. It also contains a Firebase web API key. That value is not repeated here. The GitHub image action now refuses `release=production` instead of reading those substitutions, and DEV builds pass `CAREERBRIDGE_RELEASE=dev`.

`infrastructure/docker/Dockerfile.web` accepts `CAREERBRIDGE_RELEASE`. The default is `dev`, so current DEV builds are unchanged. `production` fails the image build unless `NEXT_PUBLIC_API_URL` is https and does not contain the DEV API host, `careerbridge-f7b72`, localhost, or `srsbbucket`, and unless the Firebase project, auth domain, and storage bucket are set and are not those DEV identifiers. `NEXT_PUBLIC_AUTH_DEV_OTP=true` also fails that build. The client uses the same rule at runtime for a production release: a DEV URL or DEV Firebase project becomes unconfigured instead of being called.

### Tests and builds

All commands ran in this worktree. Exit 0 unless noted.

| Command | Result |
|---|---|
| GCS bucket, Multer filter, and task-secret tests | 13 passed |
| `test:auth` | 39 passed |
| `test:email` | 14 passed |
| `test:whatsapp` | 29 passed |
| `test:whatsapp-flow` | 29 passed |
| `test:employer` | 129 passed |
| `test:admin` | 222 passed |
| `test:interview` | 21 passed |
| `test:pii` | 25 passed |
| `test:resume` | 87 passed, 2 skipped (missing PDF fixtures). This suite includes the task-secret file again |
| `test:ai` | 16 passed |
| `test:match` | 5 passed |
| `test:photo` | 42 passed |
| `test:gst` | 14 passed |
| `test:rag` | 44 passed |
| `test:testimonials` | 34 passed |
| Web `*.unit.test.ts`, 23 files | 155 passed, including the new production-config tests |
| `@careerbridge/shared` | 75 passed |
| PII deploy preflight | 14 passed |
| GST and testimonials integration | Exit 0. Both suites skipped. No sandbox and no database |
| `npm run build -w api` | Exit 0 |
| `npm run build -w web` | Exit 0. Next.js 16.3.8 |

Unique unit tests, without counting the task-secret file twice: 1,000 passed, 0 failed, 2 skipped.

### Web artifact and container

A search of `apps/web/.next/standalone` (3,332 files) found no path named `grpc-js` or `firestore` and no file containing `@grpc/grpc-js`, `grpc-js-1.9.16`, `@firebase/firestore`, or `fire-fst`. Traced `node_modules` are `@img`, `@next`, `@opentelemetry`, `@swc`, `client-only`, `detect-libc`, `next`, `react`, `react-dom`, `semver`, `sharp`, and `styled-jsx`. This is a local Next artifact, not a published image.

`where.exe` found no `docker`, `podman`, `nerdctl`, or `gitleaks`. Nothing was installed. Cloud Build was not used. The API image was not built or scanned. UID 1001, Prisma startup, image contents, and a container CVE scan remain unverified. The container is not claimed to be secure.

### Infrastructure prerequisites

This worktree's `infrastructure/terraform/environments/prod/main.tf` only sets `project_id = "careerbridge-prod"`. That is not project `careerbridgeprod`. Do not apply it.

The real PROD root is in the original checkout at `infrastructure/terraform/environments/prod`. It was read and not edited. `enable_cloud_sql` is still false. Compute Engine remains disabled, so the proposed `10.80.16.0/24` and `10.80.0.0/20` ranges are still unverified. `constraints/compute.skipDefaultNetworkCreation` is not enforced, and the project has no organization. Private Services Access, a custom VPC, private-IP Cloud SQL, and API-only Direct VPC egress are still blocked on those checks. Provider 6.50.0 still cannot represent the live Cloud Run service-level `maxScale` of 20.

PROD Artifact Registry has no application image. All 17 PROD secret containers have no versions. Both PROD Cloud Run services are the placeholder hello image. There is no PROD database.

### Go / no-go

**No-go for deployment.** Source tests and both production builds passed. They do not establish container or live-environment security. Production deployment stays blocked until the fail-closed code is what gets built, a production web image is built with `CAREERBRIDGE_RELEASE=production` and non-DEV configuration, the API image is built and scanned, secret versions exist, and private networking plus Cloud SQL are approved separately. DEV IAM migration in sections 18 and 19 remains blocked. A later read-only check found `careerbridge-dev-db` RUNNABLE with activation policy ALWAYS, and the API health endpoint returned 200, but revision `careerbridge-api-dev-00084-8xb` logs through 2026-10-13T05:28:25Z still show `prisma migrate deploy` failing and the process refusing to start. No IAM or Cloud Run change was made.
