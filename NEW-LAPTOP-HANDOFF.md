# CareerBridge — new laptop handoff

Use this after you clone the repo on a new machine. It covers what is built so far, which branch to use, how to run locally, and what is still unfinished.

**Repo:** https://github.com/Santosh-SRSB/CareerBridge

**Do not commit** `apps/api/.env`, `apps/web/.env.local`, or any real SMTP / JWT / OpenAI / Firebase keys. Copy those files privately from the old laptop.

---

## 1. What to pull

| Branch | What it is | Use it for |
| --- | --- | --- |
| `dev` | Full product: Next.js app + Nest API + Prisma + resume / passport / jobs | **Daily development** — start here |
| `feature/live-landing` | Static marketing site (`apps/landing`) + GitHub Pages deploy | Live website only |
| `main` | Initial commit only | Ignore for work |

On the new laptop:

```bash
git clone https://github.com/Santosh-SRSB/CareerBridge.git
cd CareerBridge
git checkout dev
git pull origin dev
```

The live landing code is **not** fully on `dev`. To inspect or change the public site:

```bash
git fetch origin
git checkout feature/live-landing
git pull origin feature/live-landing
```

---

## 2. What is live today (marketing site)

| Item | Value |
| --- | --- |
| Live URL | https://www.srsbcareerbridge.com |
| Apex domain | `srsbcareerbridge.com` should **forward** to `www` (GoDaddy domain forwarding) |
| Also owned | `srsbcareerbridge.in`, `srsbcareerbridge.co.in` (forward these to www when ready) |
| Other domains | `srsbhrsolutions.com`, `srsbworkforcesolutions.com` (owned; not wired as this product) |
| Host | GitHub Pages from branch `feature/live-landing` |
| GitHub Pages custom domain | `www.srsbcareerbridge.com` (CNAME file in the export) |
| DNS | GoDaddy: `www` CNAME → `santosh-srsb.github.io.` Apex A records for GitHub Pages were used; forwarding to www may replace those |
| GitHub Actions | `.github/workflows/deploy-landing.yml` — runs on push to `feature/live-landing` |
| Pages source | GitHub **Settings → Pages → GitHub Actions** |
| Environment | `github-pages` must allow branch `feature/live-landing` |
| Sitemap | https://www.srsbcareerbridge.com/sitemap.xml |
| Search | Not instant. Add the site in Google Search Console and Bing Webmaster Tools, verify, submit the sitemap. Searching “srsb career bridge” will not list the site until Google/Bing index it. |

On the **static** live site, login / register / passport create are **Coming soon**. The real app still runs locally on `dev`.

---

## 3. Product built so far (on `dev`)

CareerBridge is a youth employability platform: Career Passport, ATS resume, jobs, applications, interviews, employer side.

### Stack

- Monorepo npm workspaces: `apps/web`, `apps/api`, `packages/shared` (`apps/landing` exists only on `feature/live-landing`)
- Web: Next.js 16 (App Router under `apps/web/src/app`), React 19, Tailwind 4
- API: NestJS, prefix `/api/v1`, Swagger at `http://localhost:3001/api/docs`
- DB: PostgreSQL 16 via Docker Compose
- ORM: Prisma (`apps/api/prisma/schema.prisma`)
- Auth: OTP (email) + JWT access/refresh; `AUTH_DEV_OTP=true` for local OTP; Firebase hooks exist but are optional
- Shared types/constants: `@careerbridge/shared`

### Local URLs

| App | URL |
| --- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| Swagger | http://localhost:3001/api/docs |
| Postgres | `127.0.0.1:5432` (also mapped `5434:5432`) |

### Candidate / landing UI

- SRSB-branded landing on `/`
- Register, login, OTP, password login
- Onboarding (name, location, education, experience, interests, complete)
- Career Passport create: form, resume upload, live build
- Passport sections: personal, photo, education, skills, experience, projects, certifications, languages, links, preferences

### Resume

- Dashboard: **Build ATS friendly Resume** → template picker → `/resume/build` (`LiveResumeSheet`)
- Templates in shared: `CLASSIC`, `MODERN`, `SIMPLE`
- PDF via `pdf-lib` (`apps/api/src/resumes/resume-pdf.ts` and `apps/web/src/lib/resume-pdf.ts`)
- Passport JPEG is embedded in the downloaded PDF (client re-encodes via canvas)
- Download button uses a **Loading...** state (`flushSync`)

### Enhance resume (ATS)

- Dashboard **Enhance Resume** → `/resume/enhance`
- Drop resume → parse `POST /api/v1/candidates/resume/parse` → save `POST /api/v1/resumes/upload` → `/resume/enhance/[id]`
- Split UI: resume left, ATS score right
- Plans in `packages/shared/src/marketplace.ts` (`ATS_ENHANCE_PLANS`): ₹99 / 69 / 49 / 39 / 29
- **Payment is not wired yet** — plans are displayed only

### Jobs / employer / interviews (present in the app)

- Jobs list, job detail, apply
- Applications list + confirmation
- Interviews + feedback
- Employer: register, profile, jobs CRUD, applications
- Admin page exists

### API modules (`apps/api/src`)

`auth`, `candidates`, `resumes`, `jobs`, `applications`, `interviews`, `employers`, `admin`, `skills`, `intelligence`, `platform` seed

### Prisma models

`User`, `Candidate`, `CandidateEducation`, `CandidateSkill`, `CandidateExperience`, `OtpRequest`, `Employer`, `Job`, `Resume`, `Application`, `Interview`, `Skill`, `RefreshToken`

---

## 4. First-time setup on the new laptop

### Software

- Git
- Node.js **22** (matches GitHub Actions)
- npm (comes with Node)
- Docker Desktop (for Postgres)
- Cursor / VS Code

### Env files (copy from old laptop; do not put secrets in git)

1. `apps/api/.env` — start from root `.env.example`
2. `apps/web/.env.local` — start from `.env.example` / `apps/web/.env.example`

Typical local values (secrets must be **your** copies, not committed):

```
# apps/api/.env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://careerbridge:careerbridge@127.0.0.1:5432/careerbridge?schema=public
JWT_ACCESS_SECRET=...change-me...
JWT_REFRESH_SECRET=...change-me...
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
WEB_ORIGIN=http://localhost:3000
AUTH_DEV_OTP=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

```
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_AUTH_DEV_OTP=true
Open_Ai_Api_key=
```

Firebase keys in `.env.example` are optional until Google login is fully used.

### Commands

From the repo root:

```bash
npm install
docker compose up -d
npm run db:generate
npm run db:migrate
npm run dev
```

- `npm run dev` starts API + web together (`concurrently`)
- `postinstall` builds `@careerbridge/shared`

If Prisma migrate asks for a name and `init` already exists, use `npm run prisma:push -w api` instead of migrate.

### Check

1. http://localhost:3000 — landing
2. http://localhost:3001/api/v1 — API
3. http://localhost:3001/api/docs — Swagger

---

## 5. How work is split (do not mix accidentally)

| Work | Branch | Notes |
| --- | --- | --- |
| App features, API, resume, passport | `dev` | Push here for development |
| Public landing, DNS, SEO/sitemap, GitHub Pages | `feature/live-landing` | Push here to redeploy www |
| Untracked junk (do not commit) | — | `apps/web/_unused_friend_app/`, `.tmp-friend-globals.css`, leftover jpg under passport features |

`dev` latest product commit (as of this note):  
`60112c5` — API, candidate passport, ATS resume builder, enhance-resume flow.

Landing-only commits live on `feature/live-landing` (`apps/landing`, Pages workflow, CNAME `www.srsbcareerbridge.com`, sitemap/robots).

---

## 6. Not done yet

- ATS enhance **payment** (Razorpay or similar)
- Full app (login, passport, dashboard) on the **live** domain — currently static landing + coming soon
- `.in` / `.co.in` forwarding confirmed in GoDaddy
- Google / Bing indexing of “SRSB CareerBridge”
- Production API + Postgres hosting (Vercel CLI was not used; live site is GitHub Pages only)
- Do not treat GitHub repo search results as the product site

---

## 7. Key files (quick map)

| Path | Why it matters |
| --- | --- |
| `apps/web/src/app/` | All Next.js pages |
| `apps/web/src/app/resume/build/` | Live ATS resume builder |
| `apps/web/src/app/resume/enhance/` | Upload + ATS score + plans UI |
| `apps/web/src/lib/resume-pdf.ts` | Client PDF + photo embed |
| `apps/api/src/resumes/` | Upload, enhance, PDF |
| `apps/api/src/candidates/` | Passport + resume parse |
| `packages/shared/src/marketplace.ts` | Resume templates + ATS prices |
| `apps/api/prisma/schema.prisma` | Database |
| `docker-compose.yml` | Local Postgres |
| `.env.example` | Env template |

On `feature/live-landing` only:

| Path | Why it matters |
| --- | --- |
| `apps/landing/` | Static export of the marketing site |
| `apps/landing/scripts/copy-public.mjs` | Copies `apps/web/public`, writes CNAME, robots, sitemap |
| `.github/workflows/deploy-landing.yml` | Pages build + deploy |

---

## 8. GoDaddy / GitHub Pages (if the live site breaks)

1. GitHub repo **Settings → Pages**: source = GitHub Actions; custom domain = `www.srsbcareerbridge.com`; HTTPS on when DNS is green.
2. DNS for `srsbcareerbridge.com`: **CNAME** `www` → `santosh-srsb.github.io.` (one www CNAME only).
3. Bare `srsbcareerbridge.com` → forward to `https://www.srsbcareerbridge.com` (301).
4. After changing landing code, push to `feature/live-landing` and wait for the **Deploy landing** Action.
5. Do not use project-site asset prefix `/CareerBridge` on the custom domain (that was only for `github.io/CareerBridge/`).

---

## 9. Suggested first day on the new laptop

1. Clone, `git checkout dev`, `npm install`, Docker up, env files, migrate, `npm run dev`.
2. Smoke-test landing, register/OTP (dev OTP), passport, resume build PDF (photo in PDF), enhance upload + plans.
3. Copy SMTP / OpenAI keys from the old machine if you need real email or parse.
4. Keep `dev` for app work; only switch to `feature/live-landing` when changing the public website.

Last updated: 21 Aug 2026.
