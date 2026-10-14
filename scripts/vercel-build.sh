#!/usr/bin/env bash
# Vercel build command (see vercel.json). Builds first, then applies pending
# migrations on Production deployments only, so a failed build never touches the
# database and a failed migration fails the deployment (the previous one stays live).
# Previews share the dev database and never migrate it: only merges to main do.
set -euo pipefail

npm run build

if [ "${VERCEL_ENV:-}" != "production" ]; then
  echo "VERCEL_ENV=${VERCEL_ENV:-unset}: skipping migrations (production only)."
  exit 0
fi

# Migrations need the session-mode connection (port 5432). Without DIRECT_URL,
# prisma.config.ts would fall back to the transaction pooler, which is unsafe for migrate.
if [ -z "${DIRECT_URL:-}" ]; then
  echo "DIRECT_URL is not set for Production: cannot apply migrations." >&2
  exit 1
fi

npx prisma migrate deploy
