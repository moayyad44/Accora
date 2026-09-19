#!/usr/bin/env bash
# The add_row_level_security migration creates the app_user database role
# with a fixed, publicly-known password ("change_me_in_production") the
# first time it runs — it has to be fixed because Prisma migrations are
# plain SQL with no way to read an environment variable at migrate time.
# Run this once right after the FIRST deploy against a brand-new database,
# then update RUNTIME_DATABASE_URL (in .env / docker-compose) to the new
# password and restart the api container.
#
# Usage:
#   ./scripts/rotate-app-user-password.sh <owner DATABASE_URL> <new password>
set -euo pipefail

DB_URL="${1:-}"
NEW_PASSWORD="${2:-}"

if [ -z "$DB_URL" ] || [ -z "$NEW_PASSWORD" ]; then
  echo "Usage: $0 <owner DATABASE_URL> <new password>" >&2
  echo "Example: $0 \"postgresql://postgres:pw@host:5432/accora\" \"\$(openssl rand -base64 32)\"" >&2
  exit 1
fi

PG_URL="$(echo "$DB_URL" | sed -E 's/([?&])schema=[^&]*&?/\1/; s/[?&]$//')"
ESCAPED_PASSWORD="${NEW_PASSWORD//\'/\'\'}"

psql "$PG_URL" -v ON_ERROR_STOP=1 -c "ALTER ROLE app_user WITH PASSWORD '${ESCAPED_PASSWORD}';"

echo "app_user password rotated. Update RUNTIME_DATABASE_URL to use it and restart the api service."
