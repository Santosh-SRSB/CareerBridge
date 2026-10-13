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

The first implementation attempt on 2026-10-13 stopped because Cloud SQL `careerbridge-dev-db` was `STOPPED`. That attempt created nothing. The resume below is the migration that ran after the instance was started again.

### Implementation result — 2026-10-13

Branch `security/dev-remediation` at `567d544`. Project `careerbridge-f7b72`, region `asia-south1`. No application image, source file, Terraform state, invoker binding, or ingress setting was changed. `roles/editor` remains on `601892050765-compute@developer.gserviceaccount.com`. No secret value was printed. No WhatsApp message was sent. No rollback was required.

Preflight after the restart: Cloud SQL `careerbridge-dev-db` was `RUNNABLE` with `activationPolicy=ALWAYS`. Revision `careerbridge-api-dev-00084-8xb` logged `No pending migrations to apply.` and `GET /api/v1/health` returned HTTP 200 with `data.status=ok`. Web revision `careerbridge-web-dev-00067-ctj` was the rollback revision. Both were on the Compute Engine identity, digests unchanged from section 19.

| Service | Revision | Traffic | Digest | Runtime identity |
|---|---|---|---|---|
| API | `careerbridge-api-dev-00085-n7q` | 100% | `api@sha256:b3bae4876cf1465b45b7668f813a75e7b4722ba18875b723cecc3b0608b23fdd` | `careerbridge-api-runtime-dev@careerbridge-f7b72.iam.gserviceaccount.com` |
| Web | `careerbridge-web-dev-00068-b67` | 100% | `web@sha256:082ed356c869ae8cc06781154253f0d93dd8d74f3ba1a604a69b8a19fafa9016` | `careerbridge-web-runtime-dev@careerbridge-f7b72.iam.gserviceaccount.com` |

Rollback revisions, still present and not receiving traffic: API `careerbridge-api-dev-00084-8xb` and web `careerbridge-web-dev-00067-ctj`, both on the Compute Engine identity.

Grants added, then read back:

| Principal | Role | Scope |
|---|---|---|
| both runtime accounts | `roles/logging.logWriter` | project |
| API runtime account | `roles/cloudsql.client` | project, condition `api-runtime-dev-cloudsql`: `resource.name == 'projects/careerbridge-f7b72/instances/careerbridge-dev-db' && resource.service == 'sqladmin.googleapis.com'` |
| API runtime account | `roles/documentai.apiUser` | project |
| API runtime account | `roles/firebasecloudmessaging.admin` | project |
| API runtime account | `roles/secretmanager.secretAccessor` | each of the 15 API secrets |
| API runtime account | `roles/storage.objectUser` | `gs://srsbbucket` |
| API runtime account | `roles/cloudtasks.enqueuer` | `resume-processing` and `whatsapp-notifications` |
| `github-deploy-dev` | `roles/iam.serviceAccountUser` | each new runtime account |

The web account has no other project role. The Compute Engine account still has its previous project roles, including `roles/editor`, and its bucket `objectAdmin` binding. Both services still grant `allUsers` `roles/run.invoker`. Ingress remains `all`.

The new API revision logged `No pending migrations to apply.` and became Ready. Health returned HTTP 200. Startup logs did not show `PERMISSION_DENIED`.

Tests that ran and passed:

- Synthetic employer registration, login, refresh, and logout against the new API identity. A wrong password returned 401. Refresh after logout returned 401.
- Employer token received 403 from `/resumes` and `/candidates/me`.
- Logo upload wrote `Images/company-logo-<synthetic-id>.png` (70 bytes) and deleted the absent `.jpg` and `.webp` siblings. The profile response was an inline image, which is the signed-URL fallback after a successful download. Both PNG objects were then deleted. A follow-up `gcloud storage ls` of those two names matched no objects.
- Web `/`, `/login`, `/register?role=candidate`, and `/register?role=employer` returned HTTP 200. The browser loaded candidate login, employer login, both registration forms, and redirected `/dashboard` and `/employer` to the matching login page. A browser employer login with an unknown example.com address returned `Incorrect email, mobile number, or password.` Web revision logs showed no permission error.

Tests not run, so they are not passes:

- Candidate resume upload, download, and delete. Candidate registration would send an OTP. That was not started.
- A Document AI `processDocument` call. The processor grant is present and was not exercised.
- A Cloud Tasks create. The enqueuer binding was read back. No task was created, because a created task would dispatch to the worker and the queue retries up to 100 times.
- The `_iam-probe/` object. Impersonating the API runtime account from the operator user failed with `iam.serviceAccounts.getAccessToken` denied. The logo upload above is the storage evidence instead. No `_iam-probe/` object was created.

The deployed task callbacks are still the `d014a458` fail-open checks. That remains a production blocker. `roles/editor` was not removed.

Implementation status: **DEV IDENTITY MIGRATION VERIFIED** for the identity switch, health, synthetic employer auth, employer/candidate isolation, storage upload and stale-object delete, and the public web flows above. Document AI processing, resume file handling, and a live Cloud Tasks enqueue remain unverified.

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

**No-go for deployment.** Source tests and both production builds passed. They do not establish container or live-environment security. Production deployment stays blocked until the fail-closed code is what gets built, a production web image is built with `CAREERBRIDGE_RELEASE=production` and non-DEV configuration, the API image is built and scanned, secret versions exist, and private networking plus Cloud SQL are approved separately. That no-go predates the DEV identity migration in section 19. Section 21 is the later verification. It does not clear this production no-go.

## 21. Remaining DEV verification — 2026-10-13

Worktree `C:\Users\ADMIN\Desktop\CareerBridge-security`, branch `security/dev-remediation`, HEAD `5e9a0995f9917225d5d554ee58b8d89cc328d7ab`. The original checkout was not edited. No commit, push, image deploy, Cloud Run change, IAM change, Terraform apply, WhatsApp send, Cloud Task create, or `roles/editor` removal. Secret values were not printed.

### Live state — passed

Commands used `--project=careerbridge-f7b72` and `--region=asia-south1` (Cloud Tasks location `asia-south1`).

| Check | Result |
|---|---|
| API revision | `careerbridge-api-dev-00085-n7q`, Ready, 100% traffic |
| API image | tag `d014a4585a813417efa4967da3f4e3c900aa70ae`, digest `api@sha256:b3bae4876cf1465b45b7668f813a75e7b4722ba18875b723cecc3b0608b23fdd` |
| API identity | `careerbridge-api-runtime-dev@careerbridge-f7b72.iam.gserviceaccount.com`, account not disabled |
| Web revision | `careerbridge-web-dev-00068-b67`, Ready, 100% traffic |
| Web image | same tag, digest `web@sha256:082ed356c869ae8cc06781154253f0d93dd8d74f3ba1a604a69b8a19fafa9016` |
| Web identity | `careerbridge-web-runtime-dev@careerbridge-f7b72.iam.gserviceaccount.com`, account not disabled |
| Ingress | `all` on both services |
| Invoker | both services still grant `allUsers` `roles/run.invoker` and `github-deploy-dev` `roles/run.developer` |
| API health | `GET /api/v1/health` HTTP 200, `data.status=ok` |
| Web root | `GET /` HTTP 200 |
| Editor | `601892050765-compute@developer.gserviceaccount.com` still has project `roles/editor` and bucket `roles/storage.objectAdmin` on `gs://srsbbucket` |

Project roles read back for the runtime accounts: both have `roles/logging.logWriter`; the API account also has conditional `roles/cloudsql.client` (`api-runtime-dev-cloudsql`), `roles/documentai.apiUser`, and `roles/firebasecloudmessaging.admin`. The web account has no other project role. The API account still has `roles/storage.objectUser` on `gs://srsbbucket` and `roles/cloudtasks.enqueuer` on `resume-processing` and `whatsapp-notifications`. No IAM binding was added or removed.

The live image is still `d014a458`, not security commit `5e9a099`. That is expected. This pass did not deploy the security commit.

### Resume file operations — not run, blocked

`AUTH_DEV_OTP` on the live API is `false` and `NODE_ENV` is `production`. Candidate registration sends an email or mobile OTP. No designated test candidate could be used without querying stored accounts or sending that OTP. The database was not queried and no account was registered.

`uploadFile` in `resumes.service.ts` always calls `enqueueResumeProcessing`. The live service sets `CLOUD_TASKS_RESUME_QUEUE=resume-processing` and a non-empty `RESUME_WORKER_URL`. Queue `resume-processing` is `RUNNING`, with `maxAttempts` 100. A file upload would create a task that the queue can dispatch and retry. That upload was not started. No existing resume object was read or deleted.

Safest alternative: a synthetic candidate that can log in with a password and no OTP, plus a queue whose dispatch is paused or a separate approved test queue, before any upload.

### Document AI — processor verified, `processDocument` not run

A regional processor read returned `displayName=CareerBridgeOCR`, `type=OCR_PROCESSOR`, `state=ENABLED`, location `asia-south1`. The processor id was not printed. IAM was not changed.

`processDocument` is reached from resume processing. That path enqueues `resume-processing`. Calling it as the operator would not prove the API runtime identity. Impersonation of that identity was already denied for `iam.serviceAccounts.getAccessToken`, and this pass did not grant Token Creator. No document was submitted. No temporary object was created.

### Cloud Tasks — unit test only

Both live queues are `RUNNING` with `maxDispatchesPerSecond` 500, `maxConcurrentDispatches` 1000, `maxBurstSize` 100, and `maxAttempts` 100. No task was created in either queue. No callback was sent to the deployed API.

`node -r ts-node/register/transpile-only --test src/resumes/security-hardening.unit.test.ts` from `apps/api`: 7 passed, 0 failed. That covers `cloudTaskSecretStatus` in commit `5e9a099`: an empty secret is `missing_secret` when `NODE_ENV` is `production` or `GCP_PROJECT_ID` is set, and a missing or wrong header is `mismatch`.

The running image is still `d014a458`. In that commit, `resumes.service.ts` uses `if (expected && providedSecret !== expected)` and `whatsapp.controller.ts` uses `if (expected && secret !== expected)`. An empty expected secret still allows the callback. That fail-open check remains a production blocker until `5e9a099` is the image that is deployed and verified. This pass did not deploy it.

### Dependency audit — not clean

Commands, from this worktree, against the committed lockfile: `npm audit --omit=dev --json` exit 1, and `npm audit --json` exit 1. Critical is 0 in both.

Production (`--omit=dev`): high 4, moderate 14, low 2, total 20.

| Severity | Package | Advisory | npm fix | Risk |
|---|---|---|---|---|
| high | `firebase@11.10.0`, `@firebase/firestore@4.8.0`, `@firebase/firestore-compat@0.3.53`, `@grpc/grpc-js@1.9.16` | GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4 | `firebase@9.14.0`, major downgrade | One chain. Firestore 4.8.0 depends on `@grpc/grpc-js` `~1.9.0` |
| moderate | `@nestjs/core` | GHSA-36xv-jgw5-4q75 | `@nestjs/core@12.1.3`, major | Not applied |
| moderate | `qs` | GHSA-q8mj-m7cp-5q26, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g | available | Not applied |
| moderate | `file-type` | GHSA-5v7r-6r5c-r473, GHSA-j47w-4g3g-c36v | available | Not applied |
| moderate | `@fastify/busboy` | GHSA-gxm5-99cw-xjw9 | available | Not applied |
| moderate | `uuid` | GHSA-w5hq-g745-h8pq | `exceljs@3.4.0`, major downgrade | Not applied |
| low | `body-parser` | GHSA-v422-hmwv-36x6 | Nest platform-express 12, major | Not applied |

The other production moderates (`@google-cloud/firestore`, `@google-cloud/storage`, `exceljs`, `firebase-admin`, `gaxios`, `google-gax`, `retry-request`, `teeny-request`, `@nestjs/common`) are transitive and were not changed. npm's fixes for several of them are major upgrades or the same Firebase downgrade.

Full audit: high 17, moderate 19, low 5, total 41. The extra findings are development tooling: `@nestjs/cli`, `eslint-config-next`, `prisma` / `@prisma/config`, `braces` (GHSA-vfj7-8cjw-p6xm), `picomatch` (GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj), `tmp` (GHSA-52f5-9888-hmc6, GHSA-ph9p-34f9-6g65), `webpack`, `ajv` (GHSA-2g4f-4pwh-qvx6), `deepmerge-ts` (GHSA-ggr8-5vv4-36mx), and their transitive highs. They are not in the production omit set.

Firebase compatibility: registry `firebase@13.0.0` still depends on `@firebase/firestore@4.18.0`, and that release still depends on `@grpc/grpc-js` `~1.9.0`. Current `@grpc/grpc-js` is 1.14.6, outside that range. An upgrade from 11 to 13 does not clear the advisory. The only npm fix is the major downgrade to `firebase@9.14.0`. No downgrade and no `@grpc/grpc-js` override was applied.

### Container verification — tools absent, checks not run

`Get-Command` found no `docker`, `podman`, `nerdctl`, `trivy`, `syft`, `grype`, or `gitleaks`. Nothing was installed. No image was built or published. These checks remain required and are not passes:

- The API image builds from `infrastructure/docker/Dockerfile.api`.
- The runtime user is `USER api` (declared in that Dockerfile, not observed in a running container from this commit).
- `apps/api/docker-entrypoint.sh` runs the image-local Prisma CLI at `/app/node_modules/.bin/prisma` and exits if that binary is missing. Startup download was not observed in a new image.
- Image layers contain no secret values.
- A vulnerability scan and a runtime smoke test of that image pass.

The live DEV image was not rebuilt, so it does not contain commit `5e9a099`.

### Production blockers

- Live task callbacks in image `d014a458` fail open when the expected secret is empty. Commit `5e9a099` fails closed and is not deployed.
- Resume upload, download, delete, and Document AI `processDocument` were not exercised on the API runtime identity.
- Production dependency audit is not clean. The Firebase/gRPC high chain has no compatible non-breaking fix in current or latest Firebase.
- The API container for `5e9a099` has not been built or scanned.
- `roles/editor` remains on the Compute Engine account until a separate approval.

Status of this pass: **PARTIALLY VERIFIED — TESTS REMAIN BLOCKED**.

## 22. Isolated verification path — 2026-10-13

Worktree `C:\Users\ADMIN\Desktop\CareerBridge-security`, branch `security/dev-remediation`, HEAD `5e9a0995f9917225d5d554ee58b8d89cc328d7ab`. Before this pass the only dirty file was this assessment. No cloud command was run. No account, bucket object, Document AI request, queue task, callback, IAM grant, or deployment was created.

### Side effects that a live test would cause

Candidate registration writes an `otpRequest` row. With live `AUTH_DEV_OTP=false` and `NODE_ENV=production`, an email channel sends the code through SMTP, and a mobile channel uses Firebase phone verification. The response does not reveal the code.

`POST /resumes/upload-file` creates a resume row, uploads the object to `gs://srsbbucket`, then calls `enqueueResumeProcessing`. On the live service the Cloud Tasks client, project, `resume-processing` queue, and worker URL are all set, and that queue is `RUNNING` with `maxAttempts` 100. A successful create dispatches `POST` to the resume worker. If create fails, the same process falls back to in-process `processUploadedResume`.

`processUploadedResume` reads and updates the resume row, downloads the object when no buffer is present, and `ParseResumePipeline` calls `ResumeExtractorService.extract`, which calls Document AI `processDocument`. It can also call Gemini, write the candidate profile, and update the document index.

`POST /whatsapp/tasks/run` with a body of `interview_invitation` or `interview_reminder` calls the WhatsApp send path, which posts to `graph.facebook.com`. An unknown task type returns `{ ok: false, reason: 'unknown_task' }` and does not send.

There is no existing paused test queue. Both live queues remain `RUNNING`. No impersonation grant was added.

### Isolated tests that ran

Command, from `apps/api`:

`node -r ts-node/register/transpile-only --test src/resumes/security-hardening.unit.test.ts`

Result: 12 passed, 0 failed, 0 skipped. The five new handler tests call `ResumesService.processWorker` and `WhatsAppController.runTask` with in-memory mocks. Missing, empty, whitespace, and wrong secrets throw `ForbiddenException` before Prisma, the resume processor, or the WhatsApp invitation and reminder methods. An exact secret reaches only the mock processor, or the mock invitation method. An unknown WhatsApp task with the correct secret returns `unknown_task` and does not call either send method. `NODE_ENV=development` together with `GCP_PROJECT_ID` still rejects an empty secret, and `NODE_ENV=production` rejects a whitespace resume secret. No live URL was called.

These tests prove the fail-closed source in commit `5e9a099`. They do not prove the Cloud Run runtime identity, and they are not in the deployed image `d014a458`.

### What is still required before a live identity check

Do not upload, call Document AI, or enqueue until all of these exist:

- A synthetic candidate session that can be created without SMTP or Firebase OTP.
- A queue that is not `resume-processing` or `whatsapp-notifications`, with dispatch paused, and an approved cleanup step. Pausing either live queue would stop real DEV processing and was not done.
- No new `iam.serviceAccounts.getAccessToken` grant. The operator still cannot impersonate `careerbridge-api-runtime-dev`.

Until then, Storage, Document AI, and Cloud Tasks on that identity stay unverified.

### Dependency audit, re-run

`npm audit --omit=dev --json` exit 1: critical 0, high 4, moderate 14, low 2, total 20.

`npm audit --json` exit 1: critical 0, high 17, moderate 19, low 5, total 41.

`npm ls --omit=dev --all` for the four highs:

`web` → `firebase@11.10.0` → `@firebase/firestore@4.8.0` and `@firebase/firestore-compat@0.3.53` → `@grpc/grpc-js@1.9.16`.

The advisory on that copy is range `<=1.13.5`: GHSA-m9gg-hp2v-232j and GHSA-f596-whhp-79r4. `firebase@13.0.0` still depends on `@firebase/firestore@4.18.0`, which still depends on `@grpc/grpc-js` `~1.9.0`. Current `@grpc/grpc-js` is 1.14.6. No non-breaking upgrade clears the finding. Firebase 9.14.0 was not installed, and no override was added.

The API production tree does not use that 1.9.16 copy. `firebase-admin@13.10.0`, `@google-cloud/documentai@9.6.2`, and `@google-cloud/tasks@7.1.0` resolve nested `@grpc/grpc-js` 1.14.5 or 1.14.6, which is outside the advisory range. Web source imports `firebase/app`, `firebase/auth`, and `firebase/messaging`. It does not import Firestore. This is a dependency-tree finding for the installed web package. It was not demonstrated as exploitable in the API or web Cloud Run process. No image was rebuilt to re-check the bundle.

### Container sequence, not run

`Get-Command` still finds no `docker`, `podman`, `nerdctl`, `trivy`, `syft`, `grype`, or `gitleaks`. Nothing was installed. The Dockerfile was not built, so `USER api` and the Prisma CLI path are source declarations only.

When a local engine and scanner are available, from this worktree at `5e9a099`, without publishing:

1. `docker build -f infrastructure/docker/Dockerfile.api -t careerbridge-api:5e9a099 .`
2. Record `docker image inspect careerbridge-api:5e9a099 --format "{{.Id}}"`. A local image has no registry digest until it is pushed. Do not push in that step.
3. Confirm `docker image inspect careerbridge-api:5e9a099 --format "{{.Config.User}}"` is `api`.
4. Confirm `docker run --rm --entrypoint /app/node_modules/.bin/prisma careerbridge-api:5e9a099 --version` runs the binary already in the image.
5. Inspect `Config.Env` for secret names and confirm none are set to values. Do not print values.
6. `trivy image --scanners vuln careerbridge-api:5e9a099`, or Syft plus Grype if Trivy is the tool that is installed.
7. Do not deploy the tag. The live DEV digests stay on `d014a458` until a separate approval.

Status of this pass: **ISOLATED SECURITY TESTS PASS — LIVE VERIFICATION STILL BLOCKED**.

## 23. Local verification and image readiness — 2026-10-13

Worktree `C:\Users\ADMIN\Desktop\CareerBridge-security`, branch `security/dev-remediation`, HEAD `5e9a0995f9917225d5d554ee58b8d89cc328d7ab`. Dirty files at the start of this pass were the isolated callback test and this assessment. No image was built or published. No cloud resource was read or changed.

### Tests run

From `apps/api`:

`node -r ts-node/register/transpile-only --test src/resumes/security-hardening.unit.test.ts src/resumes/upload-limits.unit.test.ts src/auth/jwt-secrets.unit.test.ts src/common/storage/gcs-bucket.unit.test.ts src/common/filters/http-exception.filter.unit.test.ts`

26 passed, 0 failed, 0 skipped. That includes the 12 callback and header tests.

From `apps/web`, two invocations with `node --experimental-strip-types` and plain `ts-node/register` did not load `release-config.unit.test.ts` because the web TypeScript config emits ESM without a file extension. They are loader failures, not assertion failures. The run that passed was:

`TS_NODE_COMPILER_OPTIONS={"module":"commonjs","moduleResolution":"node"} node -r ts-node/register/transpile-only --test src/lib/release-config.unit.test.ts`

4 passed, 0 failed. Production release handling drops a DEV or non-HTTPS API URL and rejects the DEV Firebase project. A non-production release still allows the local default.

### Container tooling

`docker`, `podman`, `nerdctl`, `buildkitd`, `buildctl`, `trivy`, `syft`, `grype`, and `gitleaks` are absent. Nothing was installed. No image id or registry digest exists for commit `5e9a099`. `infrastructure/cloudbuild.api.yaml` and `infrastructure/cloudbuild.web.yaml` push to Artifact Registry and also tag `:dev`. They are not a local scan path.

Approved future procedure, still not run, from this worktree at `5e9a099`:

1. Install or approve a local Docker-compatible engine and one scanner, such as Trivy, or Syft plus Grype.
2. `docker build -f infrastructure/docker/Dockerfile.api -t careerbridge-api:5e9a099 .`
3. Record `docker image inspect careerbridge-api:5e9a099 --format "{{.Id}}"`. That is a local image id. A registry digest exists only after a push, and this procedure does not push.
4. Confirm `{{.Config.User}}` is `api`.
5. Run `/app/node_modules/.bin/prisma --version` with that image's entrypoint override. The source entrypoint refuses to start when that binary is missing. This has not been observed in an image.
6. Inspect image environment names only. Runtime secrets are injected by Cloud Run, not copied from `.env`. `.dockerignore` excludes `.env`, `.env.*`, `apps/api/secrets`, service-account JSON, and Terraform.
7. Scan the local image. Repeat the web build only with `CAREERBRIDGE_RELEASE=production` and non-DEV build args. The DEV Cloud Build file is not that build: its default release is `dev`, and its Firebase client settings are the DEV project.

The API runner installs only the `api` and `@careerbridge/shared` workspaces with `npm ci --omit=dev`, then runs `npm install prisma@6 --no-save`. That Prisma install is outside the lockfile pin. The final stage declares `USER api` (uid 1001). The builder stage installs the whole workspace, including the web Firebase client, and that builder tree is not copied into the runner. None of this was confirmed inside a built image.

The web runner declares `USER nextjs` (uid 1001) and copies the Next standalone output. `NEXT_PUBLIC_*` build args are compiled into the client bundle. The runner stage does not redeclare them as image environment variables. The Dockerfile's production guard runs only when `CAREERBRIDGE_RELEASE=production`; the default is `dev`.

### Dependency evidence

`npm audit --omit=dev --json` exit 1: critical 0, high 4, moderate 14, low 2, total 20.

`npm audit --json` exit 1: critical 0, high 17, moderate 19, low 5, total 41.

The four production highs remain `firebase@11.10.0` → `@firebase/firestore@4.8.0` and `@firebase/firestore-compat@0.3.53` → hoisted `@grpc/grpc-js@1.9.16`, advisory range `<=1.13.5` (GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4). The API workspace resolves nested `@grpc/grpc-js` 1.14.5 and 1.14.6 for Document AI, Cloud Tasks, and `firebase-admin`. Those versions are outside that range.

An existing `apps/web/.next` tree, not built in this pass and not tied to a verified commit, contains 2,669 JavaScript files. Zero contain `@grpc/grpc-js` or `grpc-js-1.9.16`. The standalone tree has no `grpc-js` package. Three files contain the text `@firebase/firestore`; they are Firebase app chunks, and zero files contain `getFirestore`. Application source imports `firebase/app`, `firebase/auth`, and `firebase/messaging` only. That is static evidence about this local output and the source imports. It does not prove the finding is absent from every future bundle, and it does not prove the advisory is exploitable in Cloud Run.

### Blockers still open

- Deployed image `d014a458` still fails open on an empty task secret. Commit `5e9a099` fails closed in the tests above and is not deployed.
- The Compute Engine account still has project `roles/editor`.
- Both DEV services still allow `allUsers` `roles/run.invoker` with ingress `all`. Removing that without a separate OIDC design stops browsers and the current task callbacks.
- Storage, Document AI, and live task creation on the API runtime identity remain untested. The prerequisites in section 22 are unchanged.
- No scanned image exists for `5e9a099`.

Status of this pass: **LOCAL SECURITY VERIFICATION PASS — IMAGE SCAN STILL REQUIRED**.

## 24. Container build plan — 2026-10-13

Worktree `C:\Users\ADMIN\Desktop\CareerBridge-security`, branch `security/dev-remediation`, HEAD `5e9a0995f9917225d5d554ee58b8d89cc328d7ab`. Dirty files remain the callback test and this assessment. No image was built, tagged, or pushed. No tool was installed. No cloud resource was changed.

### Tooling recheck

Local commands found no `docker`, `podman`, `nerdctl`, `buildkitd`, `buildctl`, `trivy`, `syft`, `grype`, `gitleaks`, `crane`, `skopeo`, or `hadolint`. A local build is not possible until one engine is approved and installed.

`.github/workflows/ci.yml` has a pull-request-only `docker` job that calls `.github/actions/docker-image` with `push: false`. That job uses GitHub-hosted Docker Buildx. It does not run on this machine, it does not scan vulnerabilities, and its web path reads DEV substitutions from `infrastructure/cloudbuild.web.yaml` and sets `CAREERBRIDGE_RELEASE=dev`. The action exits if `release` is `production`. The CI secret job downloads Gitleaks 8.30.1 inside the runner and scans git commits. It does not scan image layers. `infrastructure/cloudbuild.api.yaml` and `infrastructure/cloudbuild.web.yaml` push to Artifact Registry. They are not the local plan.

### Prisma reproducibility

`package-lock.json` pins `prisma` and `@prisma/client` to `6.19.3`. `prisma` is a dev dependency, so the runner's `npm ci --omit=dev -w api -w @careerbridge/shared` does not install the CLI. The next Dockerfile line, `npm install prisma@6 --no-save`, resolves whatever `prisma@6` is current at build time and does not check the lockfile. That can install a CLI other than `6.19.3` beside the locked client.

Smallest remediation, not applied: stop that second install. The builder stage already runs `npm ci`, which installs locked `prisma@6.19.3`. Copy `node_modules/prisma`, `node_modules/@prisma/config`, `node_modules/@prisma/engines`, and `node_modules/.bin/prisma` from the builder into the runner. Do not edit the Dockerfile in this pass.

### Future local commands, not run

From this worktree, after `git rev-parse HEAD` is `5e9a0995f9917225d5d554ee58b8d89cc328d7ab`. Build context is the worktree root. `.dockerignore` excludes `.env`, `.env.*`, `apps/api/secrets`, service-account JSON, and `infrastructure/terraform`. Do not pass a secret as a build arg. Do not use the Cloud Build files or the composite action for the production web image.

API:

`docker buildx build --load --provenance=false --metadata-file api-build-metadata.json -f infrastructure/docker/Dockerfile.api -t careerbridge-api:5e9a099 --iidfile api-image-id.txt .`

Web, with non-DEV placeholders supplied at build time and not taken from the DEV Cloud Build file:

`docker buildx build --load --provenance=false --metadata-file web-build-metadata.json -f infrastructure/docker/Dockerfile.web --build-arg CAREERBRIDGE_RELEASE=production --build-arg NEXT_PUBLIC_API_URL=https://api.example.invalid/api/v1 --build-arg NEXT_PUBLIC_AUTH_DEV_OTP=false --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=prod-project-placeholder --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=auth.example.invalid --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=prod-bucket-placeholder --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=prod-client-key-placeholder --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=0 --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=prod-app-placeholder --build-arg NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID= --build-arg NEXT_PUBLIC_FIREBASE_VAPID_KEY= -t careerbridge-web:5e9a099 --iidfile web-image-id.txt .`

The Dockerfile rejects that production build if the API URL is not HTTPS or contains `careerbridge-api-dev`, `careerbridge-f7b72`, `localhost`, `127.0.0.1`, or `srsbbucket`, or if the Firebase project, auth domain, or storage bucket contains those DEV markers, or if `NEXT_PUBLIC_AUTH_DEV_OTP=true`. Replace the placeholders with the approved production values in the shell at build time. Do not write those values into the assessment or the Cloud Build DEV file.

Record, without pushing:

- `docker image inspect careerbridge-api:5e9a099 --format "{{.Id}}"` and the same for the web tag. These are local image IDs.
- `containerimage.digest` from each metadata file. That is a local manifest digest. `RepoDigests` stays empty until a registry push. Do not push to obtain one.
- API: `{{.Config.User}}` must be `api`. `docker run --rm --entrypoint /app/node_modules/.bin/prisma careerbridge-api:5e9a099 --version` must run the binary in the image. `docker run --rm --entrypoint /bin/sh careerbridge-api:5e9a099 -c "test -x ./docker-entrypoint.sh && echo entrypoint-present"` from `/app/apps/api`. Confirm image `Config.Env` has no secret names set to values. Do not print values.
- Web: `{{.Config.User}}` must be `nextjs`. Search the image filesystem for `NEXT_PUBLIC_CAREERBRIDGE_RELEASE` and confirm the compiled value is `production`, and that the bundle does not contain the DEV project id or `srsbbucket`. Do not print client keys.
- `trivy --version`, then `trivy image --scanners vuln,secret --format json --output` a file outside the repo for each tag. Record the UTC time, Trivy version, and severity counts. If Trivy is not the approved scanner, use Grype after Syft on the same local image id. Gitleaks remains a git-history scan, not an image scan.

None of these commands was run. No image-level check is a pass.

### Audit recheck

`npm audit --omit=dev --json` exit 1: critical 0, high 4, moderate 14, low 2, total 20.

`npm audit --json` exit 1: critical 0, high 17, moderate 19, low 5, total 41.

The four highs are still the installed web chain `firebase@11.10.0` → Firestore `4.8.0` / `firestore-compat@0.3.53` → `@grpc/grpc-js@1.9.16`, range `<=1.13.5`. No production image of this commit exists, so this remains an installed-tree finding, not a finding demonstrated inside an image. Dependencies were not changed.

Status of this pass: **BUILD PLAN READY — TOOLING APPROVAL REQUIRED**.

## 25. Isolated CI image workflow — 2026-10-13

Worktree `C:\Users\ADMIN\Desktop\CareerBridge-security`, branch `security/dev-remediation`, HEAD `5e9a0995f9917225d5d554ee58b8d89cc328d7ab`. The Dockerfile was not changed. No image was built and the new workflow was not dispatched.

### Prisma CLI

The builder stage runs `npm ci`, and the installed lockfile copy is `prisma@6.19.3`. The CLI also loads `@prisma/engines` and `@prisma/config`. `@prisma/config` depends on `effect`, `c12`, `deepmerge-ts`, and `empathic`. `@prisma/engines` depends on `@prisma/debug`, `@prisma/fetch-engine`, `@prisma/get-platform`, and `@prisma/engines-version`, and its engine binaries are produced by a postinstall download. Copying only `prisma`, `@prisma/config`, `@prisma/engines`, and the `.bin` shim would leave that tree behind. That copy was not made. `infrastructure/docker/Dockerfile.api` still runs `npm install prisma@6 --no-save`.

Local `node node_modules/prisma/build/index.js --version` printed `prisma : 6.19.3`. That is the workspace install, not an image.

### Workflow prepared, not run

`.github/workflows/security-image-verification.yml` triggers only on `workflow_dispatch`. The operator must type the full SHA. The job checks out that exact commit as the Docker context and checks `git rev-parse HEAD`. Permissions are `contents: read` and `actions: write`. The second permission is there so redacted reports can be uploaded. There is no registry login, image publication, Cloud Build step, or deployment step.

The web build passes `CAREERBRIDGE_RELEASE=production` and placeholder values on the reserved `.invalid` domain (`verification.invalid`, `verification-not-a-project`, `not-a-firebase-api-key`). Those values are not a Firebase project. The image tag is `careerbridge-web:verification-5e9a099`. The API tag is `careerbridge-api:verification-5e9a099`. Both use `docker buildx build --load` and are not pushed.

The workflow records local image IDs, `RepoDigests` (expected to stay empty), and Buildx `containerimage.digest` labeled as a local manifest digest. It checks runtime users `api` and `nextjs`, the API entrypoint, and that `prisma --version` contains the line `prisma : 6.19.3`. It looks for filenames such as `.env`, service-account JSON, and private keys, and does not print file contents. The web check requires the placeholder host and project to be present in `/app/apps/web`, and it rejects the concrete DEV API host and DEV Firebase domains from the Cloud Build file. The application source still contains those strings as a denylist, so a blanket search for `careerbridge-f7b72` or `localhost` is not the check.

Scanner image `aquasec/trivy:0.75.0` is pinned. The workflow writes `trivy --version` to the report. It scans saved image tarballs for `vuln` and `secret`, then deletes the tarballs. `.github/scripts/redact-trivy-report.mjs` removes `Match`, `Code`, and related fields before the JSON is uploaded. A local fixture run confirmed a sample secret string was removed and the counts stayed HIGH 1 and secrets 1. Artifact `security-image-verification-5e9a099` keeps reports for 14 days. The job fails after that upload if any prepared check did not pass. None of these image checks has run.

`actionlint` and `yamllint` are not installed. `js-yaml` parsed the workflow: the only trigger is `workflow_dispatch`, and the permissions are only `contents` and `actions`. API security tests: 26 passed, 0 failed. Web `release-config.unit.test.ts`: 4 passed, 0 failed. `git diff --check` reported no whitespace errors.

The security commit is not on a remote-tracking branch (`git branch -r --contains` was empty). A dispatch also needs this workflow file on the selected branch. Both require a later push. This pass did not push.

A review on the same day corrected three workflow gaps before any run. Full Buildx metadata files are deleted after the local manifest digest is copied out, so build arguments are not uploaded. Image tarballs and raw scanner JSON are removed by an `EXIT` trap, including when a later command fails. Trivy is invoked with `--exit-code 1`, and the job still uploads reports before it fails on a non-zero scanner exit, a high or critical finding, or a secret finding. `actions: write` stays because a workflow that sets `contents: read` cannot upload artifacts without it. The web release check from that review was replaced in section 26.

No image was built during the review. The floating Prisma install was still present at that point. Section 27 replaces it in the working tree. None of the image checks is a pass.

Status of this review: **REVIEW COMPLETE — BLOCKERS REMAIN**.

## 26. Web release check and Prisma install — 2026-10-13

Worktree `C:\Users\ADMIN\Desktop\CareerBridge-security`, branch `security/dev-remediation`, HEAD `5e9a0995f9917225d5d554ee58b8d89cc328d7ab`. No image was built. `infrastructure/docker/Dockerfile.api` was not edited.

### Web check

Next.js replaces each `process.env.NEXT_PUBLIC_*` access with its own JSON string (`node_modules/next/dist/lib/inline-static-env.js` and `define-env.js`). `.github/scripts/verify-web-release.mjs` scans compiled `.js` files for those complete string literals. The placeholder URL, `.invalid` auth domain, Firebase project, bucket, API key, and app id are accepted only as exact literals. They do not have to share a file or sit within any character distance. Concrete DEV hosts `careerbridge-api-dev-601892050765.asia-south1.run.app`, `careerbridge-f7b72.firebaseapp.com`, and `careerbridge-f7b72.firebasestorage.app` fail the scan. The short denylist inside `apps/web/src/lib/release-config.ts` (`careerbridge-f7b72`, `localhost`, `127.0.0.1`, `srsbbucket`, `careerbridge-api-dev`) is part of the compiled helper, so the scan does not treat those exact marker strings as baked endpoints.

The `.invalid` names remain verification-only. They are not a Firebase project and not a deployment configuration. The workflow records `web_deployable=false`.

`CAREERBRIDGE_RELEASE=production` is not proven by those literals. `clientApiUrl` returns the same URL for `production` and for any other release when the URL is already `https` and contains no DEV marker. `firebaseConfigAllowed` likewise returns true for both when the Firebase fields are non-empty and non-DEV. A production build also inlines `NODE_ENV` as `production`, and `isProductionRelease` compares against that same word. The Dockerfile refuses a production build that contains a DEV API URL, so the rejection branch cannot appear in an image that built successfully. Real production public values would be required before any deployable image, and they were not invented here:

- `NEXT_PUBLIC_API_URL`: an `https` URL that is not a DEV host, not localhost, and not a `.invalid` name
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`

Those values still would not prove the release flag, because a non-production build can inline the same clean URL. The workflow therefore records `web_release_behavior=not-verified` and does not write `web_inspection=pass`. This image-level check has not run.

### Prisma CLI

A one-line change to `prisma@6.19.3` would still resolve a dependency tree at build time. `effect@3.21.0` depends on `@standard-schema/spec@^1.0.0` and `fast-check@^3.23.1`. `c12@3.1.0` depends on ranged packages including `jiti`, `confbox`, and `pathe`. The runner uses `npm ci --omit=dev`, and `prisma` is a dev dependency, so that command cannot install the locked CLI without also installing the dev tree or changing `apps/api/package.json`. The current `npm install prisma@6 --no-save --ignore-scripts` also skips the `@prisma/engines` postinstall that downloads the schema engine. Copying only `prisma`, `@prisma/config`, `@prisma/engines`, and the `.bin` shim leaves out `effect`, `c12`, `deepmerge-ts`, `empathic`, and the engines packages' own dependencies. A safe fix is a later builder-stage pack of the full lockfile closure, including postinstall binaries, then a copy into the runner. That is a Docker install redesign and was not applied. The Dockerfile is unchanged.

Image-level Prisma and web results remain **NOT VERIFIED**.

Status of this pass: **BLOCKERS REMAIN — DOCKERFILE CHANGE NOT SAFE**.

## 27. Prisma closure pack and release marker — 2026-10-13

Worktree `C:\Users\ADMIN\Desktop\CareerBridge-security`, branch `security/dev-remediation`, HEAD `5e9a0995f9917225d5d554ee58b8d89cc328d7ab`. These edits are in the working tree. They are not part of commit `5e9a099`. At the time this section was written, the verification workflow still checked out that commit as the Docker context. Section 28 replaces that checkout. No image was built.

### Prisma

`infrastructure/docker/pack-prisma-cli.mjs` walks `package-lock.json` from `node_modules/prisma` through `dependencies` and `optionalDependencies`. It keeps nested packages such as `node_modules/c12/node_modules/chokidar`. It does not follow devDependencies of those packages. A local `--check` printed `prisma-closure-ok version=6.19.3 packages=35 overlap=0 engines_version=c2990dca591cba766e3b7ef5d9e8a84796e47ab7 schema_engine=present`. `require.resolve` from the Prisma package found `@prisma/config` and `@prisma/engines`. The local schema engine file is the Windows binary already in this workspace (`schema-engine-windows.exe`). It is not the Debian engine the image build downloads, and this check did not download one.

The API builder runs that script with `--download` after `prisma generate`. Download uses `@prisma/fetch-engine` with `failSilent: false` and the lockfile's `enginesVersion`. The build stops unless both the schema engine and the query engine library exist and are larger than 100 KB. The runner no longer runs `npm install prisma@6`. It extracts the packed closure, links `node_modules/.bin/prisma` at `prisma/build/index.js`, and refuses the build if that package's version is not `6.19.3`. `USER api` and `docker-entrypoint.sh` are unchanged. The download cache under `@prisma/engines/node_modules/.cache` is excluded from the archive.

This is source-level packaging. The CLI version and engine binaries are **NOT VERIFIED** inside an image.

### Web release

`infrastructure/docker/Dockerfile.web` writes `/tmp/careerbridge-release` from `$CAREERBRIDGE_RELEASE` in the same `RUN` as `next build`, after checking that `NEXT_PUBLIC_CAREERBRIDGE_RELEASE` equals that argument. The runner copies it to `/app/careerbridge-release`. `.github/scripts/verify-web-release.mjs` accepts release behavior `production` only when that file is exactly `production` or `production\n`. A compiled `"production"` string, including `NODE_ENV`, does not. `dev` fails. A missing file stays `not-verified`. Placeholder literals are still required as exact strings, and the concrete DEV hosts still fail the scan. `deployable` stays false because the `.invalid` names are not a Firebase project and not a deployment configuration.

The workflow writes `web_inspection=pass` only when the runtime user is `nextjs`, the script exits 0, the placeholders are present, the DEV hosts are absent, the release file is `production`, and no secret filenames are present. The final gate still requires `api_inspection=pass`, `web_inspection=pass`, and `scan=pass`. The API check requires `schema-engine-debian-openssl-3.0.x` larger than 100 KB in `@prisma/engines`. A Windows engine name does not satisfy that check. None of those image checks has run.

### Tests in this pass

`node infrastructure/docker/pack-prisma-cli.mjs --check`, `node .github/scripts/verify-web-release.mjs --self-test`, the redaction fixture, `js-yaml` parsing of the workflow, `release-config.unit.test.ts`, and `git diff --check` are recorded with the command results for this pass. Image build, engine download, and workflow dispatch were not run.

Status of this pass: **SOURCE FIXES READY FOR REVIEW — IMAGE VERIFICATION STILL REQUIRED**.

## 28. Exact-commit review — 2026-10-13

Worktree `C:\Users\ADMIN\Desktop\CareerBridge-security`, branch `security/dev-remediation`, HEAD `5e9a0995f9917225d5d554ee58b8d89cc328d7ab`. No commit, push, workflow dispatch, image build, image publication, or cloud change was made.

The workflow no longer checks out `5e9a099` and no longer uses a second checkout. A commit cannot contain its own hash, so the file does not hardcode the future SHA. `workflow_dispatch` checks out `github.sha`, which is the commit selected for that run. The operator must type that full SHA. The job fails unless the typed value, `github.sha`, and `git rev-parse HEAD` are the same, and unless that tree contains the Prisma pack script, the web release-file copy, and no `npm install prisma@` line. Image tags and the artifact name are derived from that SHA. Dispatching the old commit cannot run this workflow, because that commit does not contain it. Dispatching a later branch tip builds that tip only when the operator types its SHA.

`pack-prisma-cli.mjs --download` continues only when `@prisma/get-platform` reports `debian-openssl-3.0.x`. It asks `@prisma/fetch-engine` for the schema engine and query engine library, then requires both platform filenames to exist and exceed 100 KB. `failSilent: false` in that library still returns on some non-`EACCES` write errors, so the file-size check is the fail-closed gate. `schema-engine-windows.exe` and `query_engine-windows.dll.node` are refused before the archive is created. The runner deletes the archive, links `/app/node_modules/.bin/prisma` to `prisma/build/index.js` (`#!/usr/bin/env node`), marks that file and `schema-engine-debian-openssl-3.0.x` executable, and exits if the CLI version is not `6.19.3`. Local `--check` can still report `schema_engine=present` because this Windows workspace already has `schema-engine-windows.exe`. That result is not a Debian engine check.

The web verifier exits 1 unless the exact placeholder literals are present, the DEV hosts are absent, and `/app/careerbridge-release` is exactly `production` or `production\n`. `deployable` remains false. The production Dockerfile guard still rejects a non-HTTPS API URL, DEV API markers, the DEV Firebase project id, the DEV auth domain, a DEV storage bucket, and `NEXT_PUBLIC_AUTH_DEV_OTP=true` when `CAREERBRIDGE_RELEASE=production`.

The workflow token permission is `contents: read` only. It runs only on `workflow_dispatch`. It checks out `github.sha` and fails unless the typed `confirm_sha`, `GITHUB_SHA`, and `git rev-parse HEAD` match before either image build. The job uses `docker buildx build --load` and does not log in, push, or call gcloud. Trivy `aquasec/trivy:0.75.0` scans saved tarballs with `--exit-code 1`. An `EXIT` trap removes the tarballs and raw reports. Build-metadata JSON is removed before upload. The artifact is `reports/` only.

Run `38375616540` checked out `bdd209ba0b082506eb1d8aad496d99f7193f97f5` on `security/dev-remediation`. It built both images locally, both image inspections passed, and both secret scans completed with zero findings. The vulnerability scan exited 1 for both images. `reports/checks.txt` recorded `scan=fail`, and the run concluded `failure`. That run did not establish that the images are vulnerability-free. It did not push images or deploy to DEV. Duplicate run `38375657927` was cancelled before any job started. Section 29 records the finding dispositions. The live Cloud Run image is unchanged.

## 29. Image-scan triage and minimal runtime remediation — 2026-10-13

Worktree `C:\Users\ADMIN\Desktop\CareerBridge-security`, branch `security/dev-remediation`, HEAD `bdd209ba0b082506eb1d8aad496d99f7193f97f5` at the start of this edit. GitHub Actions run `38375616540` built and scanned that commit. Both final images were `node:22-bookworm-slim`, Debian 12.15, Node 22.23.3. API and web image inspections passed. Secret findings were zero. The vulnerability gate failed. No image was pushed and nothing was deployed. No new image has been built from these Dockerfile edits, so run `38375616540` still describes the images built from `bdd209ba0b082506eb1d8aad496d99f7193f97f5`.

Trivy was invoked with `--exit-code 1` and no severity filter. The workflow still requires that exit code to be 0, and it still requires `scan=pass`. This section does not change the workflow, thresholds, or ignore rules. Low, medium, and unknown findings can still fail the gate after the critical and high rows that have a bookworm fix are removed. The workflow scans the final images, not the discarded builder stages.

### Mitigated in the Dockerfiles, not yet rebuilt

`perl-base` 5.36.0-7+deb12u3 was installed in both images. Debian bookworm-security publishes `5.36.0-7+deb12u4` (DLA-4821-1, accepted 5 Oct 2026). On 13 Oct 2026 the bookworm-security `InRelease` from `deb.debian.org` named `Codename: bookworm-security`, and the pool contained `perl-base_5.36.0-7+deb12u4_amd64.deb` plus arm64, armhf, i386, and ppc64el builds. Both runner stages now install exactly `perl-base=5.36.0-7+deb12u4` and fail the build unless `dpkg-query` reports that version. There is no fallback to the older package. That pin covers these 13 findings: CVE-2026-13221, CVE-2026-42496, CVE-2026-8376, CVE-2026-42497, CVE-2026-48962, CVE-2026-57432, CVE-2026-57433, CVE-2025-15649, CVE-2026-12087, CVE-2026-19487, CVE-2026-48959, CVE-2026-7010, and CVE-2026-7017. The base image stays `node:22-bookworm-slim`. The API runner still installs `openssl` and `ca-certificates`. The web runner still installs `ca-certificates`. No full distribution upgrade is added.

The same runner stages remove `/usr/local/lib/node_modules/npm` and the `npm` and `npx` binaries only after their npm-dependent commands have finished. In the API image that is after `npm ci` and after the packed Prisma CLI is linked. In the web image the builder stage still runs `npm ci` and `next build`; the runtime stage removes npm only after the standalone copy. The next final-image scan should no longer see the npm CLI copies of `brace-expansion` 2.0.2, `picomatch` 4.0.3, `ip-address` 10.1.0, `pacote` 19.0.2 and 20.0.1, `sigstore` 3.1.0, and `@sigstore/core` 2.0.0. Those copies were under `usr/local/lib/node_modules/npm`. They were not the application lockfile copies. Removing the runtime CLI does not patch npm inside the builder stages, and those stages are not the image Trivy scans. The application lockfile is unchanged.

### No published bookworm fix

Both images had the same 255 Debian findings. Trivy listed a fixed version for only the `perl-base` rows above. The remaining Debian rows had no fixed version. High findings in that group include util-linux 2.38.1-5+deb12u3 and its libraries (CVE-2026-53613, CVE-2026-76642, CVE-2026-78408, CVE-2026-78409, CVE-2026-78410), `gzip` CVE-2026-41992, `libacl1` CVE-2026-54369, `libgnutls30` CVE-2026-88647 and CVE-2026-88648, `openssl` and `libssl3` CVE-2026-84782, `libsystemd0` and `libudev1` CVE-2026-16742, and ncurses CVE-2025-69720. `perl-base` itself still has findings that `5.36.0-7+deb12u4` does not close: CVE-2026-9538 (`fix_deferred`), CVE-2026-15534, CVE-2026-82560, CVE-2023-31486, and CVE-2011-4116. Debian still marks CVE-2026-15534 and CVE-2026-82560 vulnerable in sid. GnuTLS also has unknown-severity CVE-2026-95184, CVE-2026-95209, and CVE-2026-95210. These remain unresolved. An `apt` upgrade cannot install a version bookworm has not published.

Moving the base to Debian 13 is not the remediation. The packed Prisma engine target is `debian-openssl-3.0.x`, which is the bookworm OpenSSL 3.0 target. A newer Debian release would need a separate engine check. It also would not close every open Perl finding.

### zlib1g dispositions

`zlib1g` 1:1.2.13.dfsg-1, CVE-2023-45853, was critical in both images. Trivy status was `will_not_fix`, with no fixed version. The Debian security tracker describes the flaw in MiniZip's `zipOpenNewFileInZip4_64`, and its bookworm note says this zlib source does not build MiniZip or ship that binary. The separate `minizip` source package is already fixed in bookworm, and these images do not install it. That is evidence about the package contents Debian builds. It is not a runtime exploit test of this image, and it is not a reason to change the Debian release. Trixie marks a later zlib package fixed because that later source build is different. This finding stays a scanner finding against bookworm `zlib1g` until the scanner or the package status changes.

CVE-2026-27171 is a CPU-consumption issue fixed in zlib 1.3.2. Debian marks bookworm `no-dsa` and does not publish that version for bookworm. CVE-2026-85091's description names zlib 1.3.1.2 through 1.3.2, and the vulnerable `gz_vacate` behavior was introduced in 1.3.1.2. The installed bookworm version is 1.2.13, which is outside that stated range, but the Debian tracker still marks bookworm vulnerable and lists no fix. That conflict is unresolved. The package is left as bookworm ships it.

### Prisma deepmerge-ts

The API image, not the web image, contained `deepmerge-ts` 7.1.5 at `app/node_modules/deepmerge-ts`. It is a dependency of `@prisma/config` 6.19.3 and is copied by the Prisma CLI pack. CVE-2026-40345 / GHSA-ggr8-5vv4-36mx says versions before 8.0.0 recurse until Node throws `RangeError` when both merged values contain a self-reference at the same path. The advisory says plain JSON cannot create that graph. Version 8.0.0 changes merge behavior, including map merging and `deepmergeInto`. Forcing 8.0.0 into the Prisma 6.19.3 closure can change `prisma migrate deploy`, which the API entrypoint runs before the server starts. No lockfile override is applied. Whether Prisma passes an attacker-controlled cyclic graph into this API was not tested. Reassess when Prisma publishes a compatible bump.

### Other application findings, unchanged

The web image had no application-package findings. The API image also reported `@fastify/busboy` 3.2.1, `body-parser` 1.20.4, `qs` 6.14.2, `@nestjs/core` 10.4.22, `file-type` 20.4.1, and `uuid` 8.3.2 and 9.0.1. The fixed versions for Nest, `file-type`, and `uuid` are new majors outside the current parent ranges. `qs` 6.15.2 and 6.16.0 are outside the `~6.14.0` range required by the installed `body-parser` and Express. Those lockfile changes were not made. The application copies of `brace-expansion` and `picomatch` in the lockfile were not the vulnerable versions found under the npm CLI.

### What the next scan can still fail on

A future image build can clear the pinned Perl findings and the runtime npm CLI findings only if the build succeeds and Trivy no longer reports them. It can still fail on unfixed Debian packages, `zlib1g`, `deepmerge-ts`, and the other API application packages. Builder-stage npm is outside the scanned final image and is not patched by deleting the runtime CLI. The non-root users, API entrypoint, Prisma 6.19.3 engine check, web `node apps/web/server.js` command, release marker, and production web guards are unchanged. This image rebuild has not been run.
