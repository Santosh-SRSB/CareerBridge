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
# Incremental migrations assume a baseline schema that may be missing on a fresh Cloud SQL DB.
if [ "${RUN_PRISMA_MIGRATE:-true}" = "true" ] && [ -n "${DATABASE_URL:-}" ]; then
  echo "Running prisma migrate deploy..."
  if ! npx --yes prisma@6 migrate deploy --schema=./prisma/schema.prisma; then
    echo "prisma migrate deploy failed — bootstrapping schema with db push (DEV)"
    npx --yes prisma@6 db push --schema=./prisma/schema.prisma --skip-generate --accept-data-loss || {
      echo "prisma db push failed (continuing to start API)"
    }
    # Recover failed migration history so future deploys can migrate cleanly.
    if [ -d ./prisma/migrations ]; then
      for dir in ./prisma/migrations/*/; do
        [ -d "$dir" ] || continue
        name=$(basename "$dir")
        npx --yes prisma@6 migrate resolve --schema=./prisma/schema.prisma --rolled-back "$name" 2>/dev/null || true
        npx --yes prisma@6 migrate resolve --schema=./prisma/schema.prisma --applied "$name" 2>/dev/null || true
      done
    fi
  fi
fi

exec node dist/main.js
