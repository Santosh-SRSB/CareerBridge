# DEV CI/CD (GitHub Actions)

DEV only. UAT and PROD are not wired up.

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | Pull request into `dev` (and called by `deploy-dev.yml`) | API production build + unit tests, shared tests, web typecheck + unit tests, gitleaks secret scan, npm audit (report-only), Docker build of both images without pushing (PRs only). Never deploys. |
| `.github/workflows/deploy-dev.yml` | Push to `dev`, or manual run on `dev` | Runs CI, builds and pushes `api:<sha>` and `web:<sha>` to `asia-south1-docker.pkg.dev/careerbridge-f7b72/careerbridge-dev`, deploys the API, checks `/api/v1/health`, then deploys the Web and checks `/`. |

Deploys change only the container image of `careerbridge-api-dev` and `careerbridge-web-dev`
(`gcloud run services update --image`). Env vars, Secret Manager refs, the Cloud SQL connection,
scaling and probes stay as configured on the services. Prisma migrations keep running from
`apps/api/docker-entrypoint.sh` (`prisma migrate deploy`) when the new API revision starts; if they
fail the revision never becomes ready and the previous revision keeps serving.

Web `NEXT_PUBLIC_*` values are read from `infrastructure/cloudbuild.web.yaml`, so the manual Cloud
Build path and GitHub Actions bake the same values.

## One-time GCP setup (run by a project admin)

No Workload Identity Federation pool or deployer service account exists yet. GitHub authenticates
with short-lived OIDC tokens; no service-account key is created or stored.

The STS API must be enabled (IAM, IAM Credentials, Run and Artifact Registry already are).

```bash
PROJECT_ID=careerbridge-f7b72
PROJECT_NUMBER=601892050765
REPO=Santosh-SRSB/CareerBridge
DEPLOY_SA=github-deploy-dev@${PROJECT_ID}.iam.gserviceaccount.com
RUNTIME_SA=601892050765-compute@developer.gserviceaccount.com

gcloud services enable sts.googleapis.com --project="$PROJECT_ID"

gcloud iam workload-identity-pools create github \
  --project="$PROJECT_ID" --location=global --display-name="GitHub Actions"

# Only jobs from this repository that run in the GitHub "dev" environment can authenticate.
gcloud iam workload-identity-pools providers create-oidc careerbridge-github \
  --project="$PROJECT_ID" --location=global --workload-identity-pool=github \
  --display-name="CareerBridge GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref,attribute.environment=assertion.environment" \
  --attribute-condition="assertion.repository == '${REPO}' && assertion.environment == 'dev'"

gcloud iam service-accounts create github-deploy-dev \
  --project="$PROJECT_ID" --display-name="GitHub Actions DEV deployer"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --project="$PROJECT_ID" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"

# Push images to the existing DEV repository only.
gcloud artifacts repositories add-iam-policy-binding careerbridge-dev \
  --project="$PROJECT_ID" --location=asia-south1 \
  --member="serviceAccount:${DEPLOY_SA}" --role=roles/artifactregistry.writer

# Deploy the two DEV services only (service-level, not project-wide).
for svc in careerbridge-api-dev careerbridge-web-dev; do
  gcloud run services add-iam-policy-binding "$svc" \
    --project="$PROJECT_ID" --region=asia-south1 \
    --member="serviceAccount:${DEPLOY_SA}" --role=roles/run.developer
done

# Required to deploy revisions that run as the existing runtime service account.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --project="$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" --role=roles/iam.serviceAccountUser
```

No Owner/Editor role, no Secret Manager access and no Cloud SQL access are granted: the services
read their secrets at runtime with the runtime service account, not the deployer.

## One-time GitHub setup

1. Settings → Environments → New environment `dev`.
2. Deployment branches and tags → Selected branches → add `dev`.
3. Environment variables (not secrets; these are identifiers):
   - `GCP_WORKLOAD_IDENTITY_PROVIDER` = `projects/601892050765/locations/global/workloadIdentityPools/github/providers/careerbridge-github`
   - `GCP_DEPLOY_SERVICE_ACCOUNT` = `github-deploy-dev@careerbridge-f7b72.iam.gserviceaccount.com`

## Recommended merge policy for `dev`

Feature branch → pull request into `dev` → CI passes → review → merge → DEV deployment.

Branch protection for `dev` (Settings → Branches): require a pull request, require the CI checks
(`API · production build + unit tests`, `Shared package · build + tests`, `Web · typecheck + unit tests`,
`Security · secret scan + dependency audit`, `Docker build · api (no push)`, `Docker build · web (no push)`),
and block force pushes.

## Rollback

Every deploy uses an immutable `<commit sha>` tag, so rolling back is redeploying an earlier image:

```bash
gcloud run services update careerbridge-api-dev --region=asia-south1 --project=careerbridge-f7b72 \
  --image=asia-south1-docker.pkg.dev/careerbridge-f7b72/careerbridge-dev/api:<previous sha>
```

Prisma migrations are forward-only; rolling back the image does not roll back the schema.

## Known gaps

- `npm audit` is report-only: production dependencies currently have critical/high advisories
  (`next`, `proxy-addr` via Express, and others). Make it blocking once they are upgraded.
- Web lint is not run: `eslint` currently reports 140 errors (mostly `react-hooks/set-state-in-effect`).
- The full API typecheck including test files is report-only because a few unit-test files have
  type errors that do not affect the production build.
