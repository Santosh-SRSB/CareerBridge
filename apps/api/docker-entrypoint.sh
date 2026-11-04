#!/bin/sh
set -eu
# Build DATABASE_URL for Cloud SQL unix socket when only DB_PASSWORD is injected.
# No defaults: a missing value must never silently point a service at another environment's database.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${DB_PASSWORD:-}" ]; then
  for var in DATABASE_USER DATABASE_NAME DATABASE_HOST; do
    eval "val=\${$var:-}"
    if [ -z "$val" ]; then
      echo "DB_PASSWORD is set but $var is missing; refusing to start." >&2
      exit 1
    fi
  done
  USER="$DATABASE_USER"
  NAME="$DATABASE_NAME"
  HOST="$DATABASE_HOST"
  PASS=$(printf '%s' "$DB_PASSWORD" | sed -e 's/%/%25/g' -e 's/@/%40/g' -e 's/:/%3A/g' -e 's|/|%2F|g' -e 's/#/%23/g' -e 's/?/%3F/g' -e 's/&/%26/g' -e 's/+/%2B/g' -e 's/ /%20/g')
  export DATABASE_URL="postgresql://${USER}:${PASS}@localhost/${NAME}?host=${HOST}&schema=public"
fi

# Always apply pending Prisma migrations on boot (additive only; never db push / reset).
# PROD may still have RUN_PRISMA_MIGRATE=false in Cloud Run env; ignore that flag so
# image deploys can ship schema without needing run.revisions.list to update env vars.
# A failed migration stops startup. Fix the migration and redeploy.
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set; refusing to start (required for prisma migrate deploy)." >&2
  exit 1
fi
echo "Running prisma migrate deploy..."
if ! npx --yes prisma@6 migrate deploy --schema=./prisma/schema.prisma; then
  echo "prisma migrate deploy failed; refusing to start. The database schema was not modified by this script." >&2
  exit 1
fi

exec node dist/main.js
