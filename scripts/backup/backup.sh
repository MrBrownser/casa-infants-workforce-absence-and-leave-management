#!/usr/bin/env bash
# Encrypted full backup of the app's data (schema `public`: tables, data, RLS and
# Prisma's _prisma_migrations, which records the schema version). Run nightly by
# a GitHub Action in a separate private repository (see backup-workflow.example.yml)
# or by hand before a risky migration. The plaintext dump never leaves $TMPDIR.
#
#   BACKUP_DATABASE_URL  session-mode URL of the database (Supabase pooler :5432)
#   BACKUP_AGE_RECIPIENT age public key (age1...); the private key is kept offline
#   PG_BIN               optional directory of pg_dump (client major >= server major)
#
# Usage: scripts/backup/backup.sh <output-dir>   (prints the path of the .dump.age)
set -euo pipefail

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is not set}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is not set}"
out_dir="${1:?usage: backup.sh <output-dir>}"
pg_bin="${PG_BIN:+$PG_BIN/}"

plain="$(mktemp)"
trap 'rm -f "$plain"' EXIT

# Only `public`: Supabase's own schemas (auth, storage...) are not ours and do not
# restore into a plain Postgres. No owners or grants: the restore target decides.
"${pg_bin}pg_dump" --format=custom --schema=public --no-owner --no-privileges \
  --file="$plain" "$BACKUP_DATABASE_URL"

# A dump without the migrations table cannot be brought to the current schema.
if ! "${pg_bin}pg_restore" --list "$plain" | grep -q '_prisma_migrations'; then
  echo "Dump has no _prisma_migrations table: refusing to keep it." >&2
  exit 1
fi

file="$out_dir/casa-infants-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$file" "$plain"
echo "$file"
