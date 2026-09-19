#!/usr/bin/env bash
# Restores a backup produced by ./scripts/backup.sh into a target database.
# --clean --if-exists drops existing objects first, so this is safe to run
# against a database that already has the schema in it (a real disaster
# recovery scenario, not just an empty one). --no-owner/--no-privileges
# skip role ownership/grants from the source cluster, which usually don't
# match the target — table-level RLS policies and app_user's own grants
# come back via `prisma migrate deploy`, run separately, not from this dump.
#
# Usage:
#   ./scripts/restore.sh <backup-file> <DATABASE_URL>
set -euo pipefail

BACKUP_FILE="${1:-}"
DB_URL="${2:-${DATABASE_URL:-}}"

if [ -z "$BACKUP_FILE" ] || [ -z "$DB_URL" ]; then
  echo "Usage: $0 <backup-file> <DATABASE_URL>" >&2
  exit 1
fi
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

# Strip the Prisma-only "schema" query param — see scripts/backup.sh.
PG_URL="$(echo "$DB_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')"

pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$PG_URL" "$BACKUP_FILE"

echo "Restored $BACKUP_FILE into target database"
