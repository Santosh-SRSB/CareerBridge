# How to start CareerBridge (full stack)

This guide explains how to restart the whole CareerBridge system after pulling merges (ATS, employer UX, auth UI, mock interview, etc.).

## Where the start script lives

| Item | Path |
|------|------|
| Start script | `scripts/start-careerbridge.ps1` |
| Run from | **Repository root** (`CareerBridge/`) |

Repo root example on this machine:

```text
C:\Users\ADMIN\Desktop\CareerBridge
```

## One-command start (recommended)

1. Open **PowerShell**.
2. Go to the project root:

```powershell
cd C:\Users\ADMIN\Desktop\CareerBridge
```

3. If Windows blocks scripts the first time, allow this session:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

4. Run:

```powershell
.\scripts\start-careerbridge.ps1
```

What the script does:

1. Stops old Node / Nest / Next processes and frees ports **3000** / **3001**
2. Starts Postgres via `docker compose up -d` (unless skipped)
3. Runs `npm install` (unless skipped)
4. Builds `@careerbridge/shared`
5. Runs `prisma generate` in `apps/api`
6. Starts the full stack with `npm run dev`

## Optional flags

Skip Docker (if Postgres is already running locally):

```powershell
.\scripts\start-careerbridge.ps1 -SkipDocker
```

Skip `npm install` (faster restart when deps did not change):

```powershell
.\scripts\start-careerbridge.ps1 -SkipInstall
```

Both:

```powershell
.\scripts\start-careerbridge.ps1 -SkipDocker -SkipInstall
```

## After it is running

| Service | URL |
|---------|-----|
| Web (Next.js) | http://127.0.0.1:3000 |
| API (NestJS) | http://localhost:3001/api/v1 |
| Swagger | http://localhost:3001/api/docs |

Stop everything with **Ctrl+C** in that terminal.

## First-time / after big merges

If this is a new machine or Prisma migrations changed:

```powershell
cd C:\Users\ADMIN\Desktop\CareerBridge
copy .env.example apps\api\.env
# edit apps\api\.env and apps\web\.env / .env.local — never commit secrets

docker compose up -d
npm install
npm run db:generate
npm run db:migrate
.\scripts\start-careerbridge.ps1 -SkipInstall -SkipDocker
```

## Env files (do not commit secrets)

| App | File |
|-----|------|
| API | `apps/api/.env` (from root `.env.example`) |
| Web | `apps/web/.env` or `apps/web/.env.local` (from `apps/web/.env.example`) |

## If something fails

- **Port already in use** — re-run the script; it kills listeners on 3000/3001.
- **Docker error** — start Docker Desktop, or use `-SkipDocker` with local Postgres on `127.0.0.1:5432`.
- **Prisma EPERM** — stop the API (Ctrl+C / re-run script) then `npx prisma generate` inside `apps/api`.
- **Shared types missing** — `npm run build -w @careerbridge/shared` then restart.

## Manual start (without the script)

```powershell
cd C:\Users\ADMIN\Desktop\CareerBridge
docker compose up -d
npm run build -w @careerbridge/shared
npm run dev
```

## Branches integrated into this workspace

Friend branches merged into local `dev` (plus your uncommitted mock-interview / onboarding WIP):

- [updated-ATS](https://github.com/Santosh-SRSB/CareerBridge/tree/updated-ATS) — experienced resume parsing, ATS, builder UI
- [features/22sepemployer](https://github.com/Santosh-SRSB/CareerBridge/tree/features/22sepemployer) — employer portal / matching / payments UX
- [features/22loginreg](https://github.com/Santosh-SRSB/CareerBridge/tree/features/22loginreg) — login/register auth sheet redesign
