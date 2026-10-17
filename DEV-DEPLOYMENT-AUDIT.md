# CareerBridge — PROJECT AUDIT (DEV Deployment)

**Date:** 2026-09-24  
**GCP Project:** `careerbridge-f7b72` (601892050765) · Region `asia-south1`  
**Audit branch inspected:** local `codebase-sanitization` (working tree has uncommitted WIP)  
**Target deploy branch:** `dev` (`origin/dev` exists)  
**Status:** Audit only — **no Cloud deploy performed yet**

---

## PROJECT AUDIT

### Frontend
- **Next.js 15** (App Router) in `apps/web`
- Shared types via `@careerbridge/shared`
- Client API: centralized `apps/web/src/lib/api.ts` using `NEXT_PUBLIC_API_URL`
- Firebase phone OTP client: `apps/web/src/lib/firebase.ts`
- **Not GitHub Pages–compatible as-is** (SSR/`next start`, middleware, server routes such as `app/api/parse-resume`)
- Dev scripts bind hostname `127.0.0.1` (Firebase OTP local quirk)
- No production `sitemap.xml` / `robots.txt` in the Next app yet (landing SEO lives on GitHub Pages)

### Backend
- **NestJS** in `apps/api`, global prefix `api/v1`
- Swagger: `/api/docs`
- Health: `GET /api/v1/health` → `{ status: "ok" }` (via `@Controller('health')` + global prefix)
- JWT session + Firebase ID token verify for phone OTP
- Prisma ORM → PostgreSQL
- GCS via `@google-cloud/storage` (`GCS_BUCKET`, default `srsbbucket`)
- Document AI / Gemini / WhatsApp / GST modules present

### Database
- **PostgreSQL 16** (local: Docker Compose; target DEV: Cloud SQL `careerbridge-dev-db` / DB `careerbridge_dev` / user `careerbridge_app`)
- Prisma `DATABASE_URL` from env
- Client generated to `apps/api/generated/prisma`
- Migrations exist under `apps/api/prisma/migrations/` (do **not** reset DEV)

### Authentication
- Firebase Auth **phone OTP** (project `careerbridge-f7b72`)
- Frontend: `NEXT_PUBLIC_FIREBASE_*` (already points at careerbridge-f7b72)
- Backend Admin: explicit `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` **or** JSON path — **no ADC fallback yet**
- App JWT (access/refresh) after OTP/password login
- Staff portal `/adminsrsb` with separate admin auth

### Storage
- Bucket: `gs://srsbbucket` (private, UBLA, public access prevention)
- Folders: `resumes/`, `Images/`
- Code already uses flat keys under those folders
- Prefers ADC / GCS SA (`allowFirebaseSa: false` in storage init)

### Current deployment
| Item | Status |
|---|---|
| Local | `npm run dev` / `scripts/start-careerbridge.ps1` + Compose Postgres |
| CI | `.github/workflows/ci-cd.yml` — **build/validate only** on `main`/`dev` (no Artifact Registry / Cloud Run push) |
| Docker | `infrastructure/docker/Dockerfile.api` + `Dockerfile.web` — **incomplete for monorepo/Prisma** |
| Terraform | Scaffold under `infrastructure/terraform` (placeholders; DEV locals still say `careerbridge-dev` not `careerbridge-f7b72`) |
| Production domain | `www.srsbcareerbridge.com` → **GitHub Pages** (`santosh-srsb.github.io`) — **leave untouched** |
| Apex | `srsbcareerbridge.com` → `15.197.225.128`, `3.33.251.168` (typical registrar forwarding; **not** inventing Cloud Run IPs) |

### Current frontend URL
- Local: `http://127.0.0.1:3000`
- Public today: `https://www.srsbcareerbridge.com` (landing on GitHub Pages)
- DEV app URL: **not deployed yet** (will be Cloud Run / other host temporary URL)

### Current API URL
- Local default: `http://localhost:3001/api/v1` (hardcoded fallbacks in several places)
- Deployed DEV API: **not live yet**

### Docker
- API Dockerfile: `npm ci` + `npm run build -w api` then `node apps/api/dist/main.js`
- **Gaps:** no `prisma generate`, incomplete workspace copy for `@careerbridge/shared`, no multi-stage Prisma engines, no explicit Cloud Run listen notes, no `.dockerignore` at repo root for these Dockerfiles
- Web Dockerfile: builds Next but not `standalone` output; needs server runtime (Cloud Run), **not** static GitHub Pages

### Environment variables (high level)
**API:** `PORT`, `DATABASE_URL`, `JWT_*`, `WEB_ORIGIN`, `FIREBASE_*`, `GCS_BUCKET`, `GCP_PROJECT_ID`, `GEMINI_*`, WhatsApp, GST, Document AI, `API_PUBLIC_URL`, SMTP, etc.  
**Web:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH_DEV_OTP`, `NEXT_PUBLIC_FIREBASE_*`  
**Secrets:** DB password expected from Secret Manager `careerbridge-db-password` (never hardcode)

### Firebase
- Project ID matches GCP: `careerbridge-f7b72`
- Auth domain: `careerbridge-f7b72.firebaseapp.com`
- **Must add authorized domains** for deployed frontend + eventually `www.srsbcareerbridge.com` (keep `localhost` / `127.0.0.1` for local)
- Backend must verify ID tokens on Cloud Run via **ADC or Secret Manager–injected** credentials — **not** committed JSON

### Potential deployment problems
1. **Hardcoded localhost fallbacks** in `api.ts`, `structure-resume.ts`, `parse-resume/route.ts`, Nest `WEB_ORIGIN` defaults, portal link builders
2. **`app.listen(port)`** should explicitly use `0.0.0.0` for Cloud Run clarity
3. **Health path** is `/api/v1/health`, not bare `/health` — Cloud Run probes must match (or add root `/health`)
4. **Dockerfile.api** missing Prisma generate + monorepo packaging
5. **Firebase Admin** does not fall back to `applicationDefault()` on Cloud Run
6. **CORS** defaults to single localhost origin — DEV needs comma-separated `WEB_ORIGIN` including temp Cloud Run frontend URL + final domain
7. **No deploy pipeline** to Artifact Registry / Cloud Run yet (CI only builds)
8. **Working tree ≠ clean `dev`** — large uncommitted WIP on `codebase-sanitization`; deploy must be from agreed `dev` commit
9. **GitHub Pages cannot host this Next app** — separate frontend hosting required for DEV
10. **SEO:** do not put Cloud Run URLs into production sitemap; leave GH Pages sitemap alone until cutover
11. **Terraform DEV project_id mismatch** (`careerbridge-dev` vs real `careerbridge-f7b72`)
12. **`.env.example` embeds a Firebase web API key** (public by design, but example should stay template-only where possible)

### Recommended deployment sequence
1. Freeze / merge deployable code onto **`dev`** (decide: current WIP vs `origin/dev`)
2. Fix Cloud Run readiness: PORT bind, CORS env, health, remove production localhost fallbacks, Firebase ADC, Dockerfile + `.dockerignore`
3. Local `npm ci` → build shared → prisma generate → build api/web → Docker build API image
4. Push image → `asia-south1-docker.pkg.dev/careerbridge-f7b72/careerbridge-dev/api:<sha>`
5. Deploy Cloud Run API with Cloud SQL connector + Secret Manager password + GCS/Firebase IAM
6. Deploy Next frontend to Cloud Run (or equivalent) with `NEXT_PUBLIC_API_URL` = Cloud Run API
7. Add Firebase authorized domain for frontend host
8. E2E: health, OTP, DB write, resume upload to `srsbbucket`
9. **Only later:** point `www.srsbcareerbridge.com` off GitHub Pages onto the app

### DNS inventory (do not change yet)
| Host | Resolves to | Notes |
|---|---|---|
| `srsbcareerbridge.com` | `15.197.225.128`, `3.33.251.168` | Apex / forwarding — treat as `<CAREERBRIDGE_DEV_IP>` owners; **not** Cloud Run |
| `www.srsbcareerbridge.com` | GitHub Pages `185.199.108–111.153` → `santosh-srsb.github.io` | Keep until app verified |

---

## Deployment progress (2026-09-24)

### Done
- Pushed all WIP to `origin/dev` (through `bfef338`)
- Cloud Build API image → `asia-south1-docker.pkg.dev/careerbridge-f7b72/careerbridge-dev/api:*`
- Cloud Run service **`careerbridge-api-dev`** live in `asia-south1`
- Health OK: `GET /health` and `GET /api/v1/health` → 200
- Cloud SQL connected; Prisma migrate runs on container boot
- IAM: compute SA has `secretmanager.secretAccessor`, `cloudsql.client`, `storage.objectAdmin`

### Service URL
`https://careerbridge-api-dev-601892050765.asia-south1.run.app`

### Still TODO (next)
- Deploy Next.js frontend (Cloud Run) with `NEXT_PUBLIC_API_URL=<API>/api/v1`
- Add Firebase authorized domain for the frontend host
- Point DNS only after frontend E2E (OTP, upload) passes — keep GitHub Pages until then

---
