#!/bin/sh
set -eu
# Build DATABASE_URL for Cloud SQL unix socket when only DB_PASSWORD is injected.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${DB_PASSWORD:-}" ]; then
  USER="${DATABASE_USER:-careerbridge_app}"
  NAME="${DATABASE_NAME:-careerbridge_dev}"
  HOST="${DATABASE_HOST:-/cloudsql/careerbridge-f7b72:asia-south1:careerbridge-dev-db}"
  PASS=$(printf '%s' "$DB_PASSWORD" | sed -e 's/%/%25/g' -e 's/@/%40/g' -e 's/:/%3A/g' -e 's|/|%2F|g' -e 's/#/%23/g' -e 's/?/%3F/g' -e 's/&/%26/g' -e 's/+/%2B/g' -e 's/ /%20/g')
  export DATABASE_URL="postgresql://${USER}:${PASS}@localhost/${NAME}?host=${HOST}&schema=public"
fi

# Apply pending Prisma migrations (safe for DEV/Cloud Run first boot).
if [ "${RUN_PRISMA_MIGRATE:-true}" = "true" ] && [ -n "${DATABASE_URL:-}" ]; then
  echo "Running prisma migrate deploy..."
  npx --yes prisma@6 migrate deploy --schema=./prisma/schema.prisma || {
    echo "prisma migrate deploy failed (continuing to start API)"
  }
fi

exec node dist/main.js
