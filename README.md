# CareerBridge

Youth employability platform — Career Passport, ATS resume builder, jobs, interviews, and employer onboarding.

**Daily development branch:** `dev`

## Local stack (matches what we run day to day)

| Service | Command | URL |
| --- | --- | --- |
| API (NestJS) | `npm run dev:api` | http://localhost:3001/api/v1 |
| Web (Next.js) | `npm run dev:web` | http://localhost:3000 |
| Both together | `npm run dev` | API + web via `concurrently` |
| Swagger | (with API running) | http://localhost:3001/api/docs |
| Postgres | Docker or local install | `127.0.0.1:5432` |

Web uses **Next.js with webpack** (`next dev --webpack`) so the ATS resume editor and `.jsx` templates load reliably.

## First-time setup

```bash
git clone https://github.com/Santosh-SRSB/CareerBridge.git
cd CareerBridge
git checkout dev
npm install
docker compose up -d          # or use a local Postgres on 5432
npm run db:generate
npm run db:migrate
```

Copy env files (do not commit secrets):

- `apps/api/.env` — from root `.env.example`
- `apps/web/.env.local` — from `apps/web/.env.example`

Then start everything:

```bash
npm run dev
```

More detail: [NEW-LAPTOP-HANDOFF.md](./NEW-LAPTOP-HANDOFF.md)
