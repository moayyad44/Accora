#!/usr/bin/env bash
# Backs up the Accora database to a single timestamped file using pg_dump's
# custom format (compressed, and the only format pg_restore --clean can
# rebuild selectively/in parallel from). Point DATABASE_URL at the
# Postgres *owner* connection (never the app_user runtime one — app_user
# only has table-level DML/DDL grants, not the privileges pg_dump needs to
# read schema/role metadata cleanly).
#
# Usage:
#   DATABASE_URL="postgresql://postgres:pw@host:5432/accora?schema=public" ./scripts/backup.sh
#   ./scripts/backup.sh "postgresql://postgres:pw@host:5432/accora?schema=public"
#
# Output: backups/accora_<UTC timestamp>.dump (BACKUP_DIR overrides the
# directory). Restore with ./scripts/restore.sh <file> <target DATABASE_URL>.
set -euo pipefail

DB_URL="${1:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "Usage: $0 <DATABASE_URL>  (or set DATABASE_URL in the environment)" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/accora_${TIMESTAMP}.dump"

# Accora's .env files use Prisma-style URLs ("...?schema=public"), but
# `schema` isn't a libpq connection parameter — pg_dump rejects it outright.
# Strip it (and it alone) before handing the URL to pg_dump.
PG_URL="$(echo "$DB_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')"

pg_dump --format=custom --file="$OUT_FILE" "$PG_URL"

echo "Backup written to $OUT_FILE"
