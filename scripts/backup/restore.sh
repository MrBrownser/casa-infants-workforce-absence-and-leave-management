#!/usr/bin/env bash
# Restore an encrypted backup into an EMPTY database, then bring it to the
# schema of the code checked out here with `prisma migrate deploy` (migrations
# are forward-only and backward compatible, README -> Migrations). Run from the
# repository root after `npm ci`.
#
#   RESTORE_DATABASE_URL  direct or session-mode URL of the empty target database
#   AGE_IDENTITY_FILE     file with the age private key
#   PG_BIN                optional directory of pg_restore / psql
#
# Usage: scripts/backup/restore.sh <file.dump.age>
set -euo pipefail

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is not set}"
: "${AGE_IDENTITY_FILE:?AGE_IDENTITY_FILE is not set}"
file="${1:?usage: restore.sh <file.dump.age>}"
pg_bin="${PG_BIN:+$PG_BIN/}"

tables="$("${pg_bin}psql" "$RESTORE_DATABASE_URL" -Atc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
if [ "$tables" != "0" ]; then
  echo "The target database already has $tables table(s) in public: restore only into an empty one." >&2
  exit 1
fi

plain="$(mktemp)"
trap 'rm -f "$plain"' EXIT
age --decrypt --identity "$AGE_IDENTITY_FILE" --output "$plain" "$file"

# --clean --if-exists replaces the empty `public` schema a new database already has.
"${pg_bin}pg_restore" --no-owner --no-privileges --clean --if-exists --exit-on-error \
  --dbname="$RESTORE_DATABASE_URL" "$plain"

DIRECT_URL="$RESTORE_DATABASE_URL" npx prisma migrate deploy
