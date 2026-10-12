# Employer PII encryption (GSTIN / PAN / CIN) — DEV runbook

Status: prepared for review. Nothing in this document has been run against DEV.

DEV only (`careerbridge-f7b72`, `asia-south1`, `careerbridge-api-dev`). UAT and PROD are not configured; each needs
its own independently generated keys and containers, never copies of DEV's.

| Cloud Run env var | Source | DEV value |
|---|---|---|
| `PII_ENCRYPTION_KEYS` | Secret Manager `careerbridge-pii-encryption-keys`, **version `1`** (pinned) | `dev1:<base64 32-byte key>` |
| `PII_LOOKUP_KEY` | Secret Manager `careerbridge-pii-lookup-key`, **version `1`** (pinned) | `<base64 32-byte key>`, different from every encryption key |
| `PII_ENCRYPTION_ACTIVE_KEY_ID` | Plain env var (not secret) | `dev1` |

Without a valid keyring the API still starts, logs `PII encryption is not available: …`, and refuses employer KYC
saves with 503 (fail closed). With one it logs
`PII keyring loaded: active key id=dev1, keys=1, fingerprint=kfp1-…` once per instance start.

## Order

Each step needs its own approval. Do not reorder: the deploy gate (step 5) blocks every DEV deploy until step 3 is
done, and data must never be encrypted (step 6) before its keys are safely in place.

1. Terraform: create the two secret containers.
2. Add version `1` to each container.
3. Bind both secrets at version `1`, and the active key id, to `careerbridge-api-dev` with `gcloud`.
4. Mirror the binding in `cloud-run-env.tf`; plan must show no changes.
5. Merge the feature and the deploy gate into `dev`; the pipeline deploys it.
6. Post-deploy runtime checks.
7. Backfill legacy plaintext (separate authorisation).

## 1. Terraform (two containers)

Config: `infrastructure/terraform/environments/dev/pii-secrets.tf` (module `pii_secrets`, containers only, no
versions, no import blocks, no Cloud Run change). Locally reviewed with `terraform fmt -check` and
`terraform validate` only; no plan has been run.

From `infrastructure/terraform/environments/dev`, with Terraform 1.15.9 and the GCS backend:

```bash
terraform init
terraform plan -out=pii-secrets.tfplan
```

Approve only if the plan is exactly **2 to add, 0 to change, 0 to destroy**:

- `module.pii_secrets.google_secret_manager_secret.this["careerbridge-pii-encryption-keys"]`
- `module.pii_secrets.google_secret_manager_secret.this["careerbridge-pii-lookup-key"]`

Anything touching `google_cloud_run_v2_service` (or any other existing resource) means stop: Cloud Run must not be
updated through Terraform on google 6.50 (it can drop the service-level `maxInstanceCount = 20`).

```bash
terraform apply pii-secrets.tfplan
terraform plan            # must report: No changes.
```

Destroying `module.pii_secrets` deletes the containers **and every version**. Once any data is encrypted that is
unrecoverable data loss. Review any plan that shows a destroy of these addresses as a stop condition.

## 2. Add version 1 (out of band, operator only)

Run in Cloud Shell (bash) by someone with `secretmanager.versions.add`. The keys are generated in a pipe and never
echoed, written to disk, pasted into chat, or stored anywhere else. Do not run this in PowerShell (it alters piped
bytes).

```bash
PROJECT_ID=careerbridge-f7b72
printf 'dev1:%s' "$(openssl rand -base64 32)" \
  | gcloud secrets versions add careerbridge-pii-encryption-keys --project="$PROJECT_ID" --data-file=-
printf '%s' "$(openssl rand -base64 32)" \
  | gcloud secrets versions add careerbridge-pii-lookup-key --project="$PROJECT_ID" --data-file=-

# Metadata only (no payload): each must show version 1, state ENABLED.
gcloud secrets versions list careerbridge-pii-encryption-keys --project="$PROJECT_ID"
gcloud secrets versions list careerbridge-pii-lookup-key --project="$PROJECT_ID"
```

If either command reports a version other than `1`, stop: the gate and the binding below pin version `1`.

Never disable or destroy version `1` of either secret while any ciphertext or lookup hash written with it exists.
`PII_LOOKUP_KEY` is never rotated: changing it breaks duplicate-company detection for every stored GSTIN.

## 3. Bind to `careerbridge-api-dev` (gcloud, not Terraform)

The runtime service account (`601892050765-compute@developer.gserviceaccount.com`) already has project-level
`roles/secretmanager.secretAccessor`. Record the current state first:

```bash
gcloud run services describe careerbridge-api-dev --region=asia-south1 --project=careerbridge-f7b72 \
  --format='value(status.latestReadyRevisionName,spec.template.spec.containers[0].image)'
```

```bash
gcloud run services update careerbridge-api-dev --region=asia-south1 --project=careerbridge-f7b72 \
  --update-secrets=PII_ENCRYPTION_KEYS=careerbridge-pii-encryption-keys:1,PII_LOOKUP_KEY=careerbridge-pii-lookup-key:1 \
  --update-env-vars=PII_ENCRYPTION_ACTIVE_KEY_ID=dev1
```

This creates a revision of the **currently deployed image** (pre-feature code ignores these variables). Verify:

- the new revision is Ready and serves 100% of traffic (proves Cloud Run could access version `1` of both secrets);
- service-level max instances is still 20 (Cloud Run Admin API v2 `scaling.maxInstanceCount`, or Console → service
  → Edit → Service scaling; `terraform plan` cannot show it on google 6.50); every other env var and secret
  reference is unchanged (compare `gcloud run services describe` before and after);
- `GET https://careerbridge-api-dev-601892050765.asia-south1.run.app/api/v1/health` returns `status: ok`.

Rollback for this step only (no data encrypted yet): `gcloud run services update … --remove-secrets=PII_ENCRYPTION_KEYS,PII_LOOKUP_KEY --remove-env-vars=PII_ENCRYPTION_ACTIVE_KEY_ID`.

## 4. Mirror in Terraform

In `infrastructure/terraform/environments/dev/cloud-run-env.tf`:

```hcl
# api_env
PII_ENCRYPTION_ACTIVE_KEY_ID = "dev1"

# api_secret_env
PII_ENCRYPTION_KEYS = { secret = "careerbridge-pii-encryption-keys", version = "1" }
PII_LOOKUP_KEY      = { secret = "careerbridge-pii-lookup-key", version = "1" }
```

Then `terraform plan` must report **No changes**. Any diff on the Cloud Run service means the mirror is wrong; fix
the config, never apply it. Do not add these lines before step 3: the config would then differ from the live service
and the only way to converge would be a forbidden Terraform update of Cloud Run.

## 5. Deploy gate (`.github/workflows/deploy-dev.yml`)

Job `pii-preflight` runs first on every DEV deploy; `ci`, `build`, `deploy-api` (and therefore migrations, which run
at API container start) and `deploy-web` all depend on it. `deploy-api` re-runs the same check immediately before
`gcloud run services update --image`. Implementation: `.github/actions/pii-preflight` (describes the service and
its latest ready revision) and `.github/scripts/pii-deploy-preflight.mjs` (tests:
`node --test .github/scripts/pii-deploy-preflight.test.mjs`, also run by CI).

It fails the deploy unless **both** the service template (what the new revision inherits) **and** the latest ready
revision have:

- `PII_ENCRYPTION_KEYS` exactly once, as a Secret Manager reference to `careerbridge-pii-encryption-keys` version `1`;
- `PII_LOOKUP_KEY` exactly once, as a reference to `careerbridge-pii-lookup-key` version `1`;
- `PII_ENCRYPTION_ACTIVE_KEY_ID` exactly once, as the plain value `dev1`.

Missing, `latest`, any other version, the wrong or swapped secret, a plain-text value, duplicates, a non-Ready
revision, an unparseable description, or a missing expected value in the workflow all fail closed. A newer revision
that failed to become ready (for example after a failed migration) is reported as a warning and does not lock out
the fix, because the template and the ready revision are what is checked.

It prints secret names, versions and revision names only, never secret payloads or other env values. The service
description it reads lives in a temp directory that is deleted when the step ends.

What the gate cannot prove, and why:

- **A container existing proves nothing** and is not checked. The proof that version `1` is accessible is a Ready
  revision that references it: Cloud Run does not start a revision whose secret versions it cannot access.
- **Key format and usability** (valid base64, 32 bytes, lookup key different from the encryption key) are only
  visible by reading the payload, which the gate must not do. Only the startup log line in step 6 proves the keyring
  loads.
- **Version state after the revision started** (a version disabled or destroyed later) would need
  `roles/secretmanager.viewer` for `github-deploy-dev`, which deliberately has no Secret Manager access
  (`docs/ci-cd-dev.md`). Not implemented; a disabled version would make the new revision fail to start, and the
  existing health and readiness checks keep the old revision serving.

To change the pinned version or key id later (rotation), update `PII_SECRET_VERSION` / `PII_ACTIVE_KEY_ID` in the
workflow in the same change that follows the re-binding.

## 6. Post-deploy runtime checks (after the feature revision is live)

Only possible once the feature code is running; the step 3 revision runs the old image and logs nothing about PII.

```bash
REV=$(gcloud run services describe careerbridge-api-dev --region=asia-south1 --project=careerbridge-f7b72 \
  --format='value(status.latestReadyRevisionName)')
gcloud logging read \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"careerbridge-api-dev\" AND resource.labels.revision_name=\"$REV\" AND \"PII keyring loaded\"" \
  --project=careerbridge-f7b72 --freshness=1h --limit=5 --format='value(timestamp,textPayload,jsonPayload.message)'
gcloud logging read \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"careerbridge-api-dev\" AND resource.labels.revision_name=\"$REV\" AND \"PII encryption is not available\"" \
  --project=careerbridge-f7b72 --freshness=1h --limit=5 --format='value(timestamp)'
```

Pass when:

- the first query shows `active key id=dev1, keys=1, fingerprint=kfp1-…` for every instance start, all with the same
  fingerprint (record it: the backfill needs it);
- the second query returns nothing;
- the pipeline's health check passed (`/api/v1/health` → `ok`);
- an employer KYC save on DEV (mock GSTIN) succeeds instead of returning 503;
- Admin / Super Admin company details show the business location and a masked GSTIN only.

If the keyring line is missing or the "not available" line appears: KYC is refused (503) but nothing is written in
plaintext. Fix the secret value (new version, re-bind, update the pinned version in the workflow) and roll forward.

## Rollback limitation

Before any ciphertext exists (steps 1–5 with no KYC saved yet), rolling back the image is safe.

Once any employer has saved KYC, or the backfill has run, the database holds `pii:v1:…` ciphertext and HMAC lookup
hashes. Pre-feature code would then show ciphertext in the UI, fail plaintext GSTIN lookups, and create duplicate
plaintext companies for GSTINs that already exist. From that point:

- roll **forward**, or redeploy an earlier **feature** revision with the same keyring; do not redeploy a pre-feature
  image (the generic rollback in `docs/ci-cd-dev.md` does not apply to it);
- never unbind the secrets, remove `dev1` from `PII_ENCRYPTION_KEYS`, or disable/destroy version `1` of either
  secret; the data becomes unreadable;
- Prisma migrations are forward-only; rolling back the image does not roll back the schema.

## 7. Backfill prerequisites (separate authorisation; not started)

`apps/api/scripts/backfill-business-id-encryption.ts` encrypts legacy plaintext employer GSTIN/PAN/CIN, company GSTIN
and GST audit GSTIN and fills `gstin_hash`. Before any run:

- written authorisation for a DEV database write;
- step 6 passed, and its fingerprint recorded from the **target revision's** log (not from the backfill environment);
- a verified Cloud SQL backup of `careerbridge-dev-db` taken immediately before `--apply` (the instance must be
  running);
- an approved place to run it that receives `DATABASE_URL`, `PII_ENCRYPTION_KEYS`, `PII_LOOKUP_KEY` and
  `PII_ENCRYPTION_ACTIVE_KEY_ID` without keys being written to disk or shell history. **Gap:** none is approved yet.
  A Cloud Run Job from the API image with the same secret references would keep keys inside GCP, but whether the
  production image contains the script and `ts-node` has not been checked.

Sequence (stop at the first failure):

```bash
npx ts-node -T scripts/backfill-business-id-encryption.ts                 # dry run: counts only
npx ts-node -T scripts/backfill-business-id-encryption.ts --verify        # read-only; expected to report work left
npx ts-node -T scripts/backfill-business-id-encryption.ts --apply \
  --database=careerbridge_dev --expect-key-fingerprint=kfp1-<from step 6>
npx ts-node -T scripts/backfill-business-id-encryption.ts --verify        # must exit 0
```

`--apply` refuses to write unless the connected database is `careerbridge_dev` and the keyring fingerprint matches.
A read-only preflight runs before any write and refuses if any stored value is undecryptable or any hash mismatches.
It prints counts only, never identifier values or key material.
