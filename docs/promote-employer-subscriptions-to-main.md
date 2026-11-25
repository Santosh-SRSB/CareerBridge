# Promote employer subscriptions → main / prod (SAFE)

**Do not merge or deploy until SRSB explicitly approves each step.**

Backups already taken (2026-11-25):
- Code: `backup/main-20261125-before-employer-subscriptions` (= `origin/main` @ `6d55fac`)
- DB: Cloud SQL on-demand backup `1795584027797` on `careerbridgeprod` / `careerbridge-prod-db` (SUCCESSFUL)

## What this branch does

Branch: `promote/employer-subscriptions-safe`

- Brings employer-subscription / Razorpay / billing / admin offer code from `dev`
- Catalogue prices restored to **₹999 / ₹2,999 / ₹5,999** (not DEV ₹1)
- **`EMPLOYER_SUBSCRIPTIONS_LIVE` defaults OFF**  
  → prod employers keep today’s free Starter + platform_settings behaviour  
  → no sudden paywall on merge/deploy

## What must stay true on live

| Rule | How |
|------|-----|
| No behaviour change until you say go-live | Leave `EMPLOYER_SUBSCRIPTIONS_LIVE` unset/false on `careerbridge-api-prod` |
| Additive DB only | Prisma migrations create new tables/columns; no drops of existing employer data |
| Separate Razorpay from DEV | Prod keys + prod webhook URL + approved **prod** website domain |
| Rollback | Keep flag false, or redeploy previous image; restore DB from backup `1795584027797` only if needed |

## Approved sequence (ask before each)

1. **Review PR** `promote/employer-subscriptions-safe` → `main` (CI green). **Do not merge yet.**
2. **Migrate prod DB** (additive) in a maintenance window — ask first.
3. **Merge PR** to `main` — ask first.
4. **Deploy prod API/Web** with flag still **false** — ask first. Smoke: login, post job, candidates (same as today).
5. Configure Razorpay **prod** webhook + website allowlist — ask first.
6. Set `EMPLOYER_SUBSCRIPTIONS_LIVE=true` on prod API — **only after** you approve go-live.
7. Controlled paid smoke, then monitor.

## Explicitly out of this PR

- DEV-only scripts (`set-razorpay-api-dev.ps1`, DEV migrate job, `cloudrun-api-dev.env.yaml`)
- Changing DNS / unrelated product features
- Turning the paywall on automatically
