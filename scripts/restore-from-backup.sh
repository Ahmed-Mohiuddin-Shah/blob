#!/usr/bin/env bash
# Restore Postgres from a pgbackups dump (gzipped SQL).
# Usage: ./scripts/restore-from-backup.sh [path-to.sql.gz]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${ROOT}/storage/backups/postgres"
FILE="${1:-}"

if [[ -z "${FILE}" ]]; then
  # Prefer last/blob-latest.sql.gz, else newest under daily/
  if [[ -f "${BACKUP_DIR}/last/blob-latest.sql.gz" ]]; then
    FILE="${BACKUP_DIR}/last/blob-latest.sql.gz"
  else
    FILE="$(find "${BACKUP_DIR}" -name '*.sql.gz' -type f 2>/dev/null | sort | tail -1 || true)"
  fi
fi

if [[ -z "${FILE}" || ! -f "${FILE}" ]]; then
  echo "No backup file found. Pass a path: npm run db:restore -- ./storage/backups/postgres/daily/blob-YYYYMMDD.sql.gz"
  exit 1
fi

echo "About to RESTORE database from:"
echo "  ${FILE}"
echo "This replaces current data in the compose 'db' service."
read -r -p "Type 'yes' to continue: " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi

# Load DB_* from .env if present
if [[ -f "${ROOT}/.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  # ponytail: only export DB_* lines
  eval "$(grep -E '^DB_(DATABASE|USERNAME|PASSWORD)=' "${ROOT}/.env" | sed 's/\r$//')"
  set +a
fi

DB_DATABASE="${DB_DATABASE:-blob}"
DB_USERNAME="${DB_USERNAME:-blob_admin}"
DB_PASSWORD="${DB_PASSWORD:-}"

echo "Stopping app (if running)..."
docker compose -f "${ROOT}/docker-compose.yml" stop app 2>/dev/null || true

echo "Restoring..."
gunzip -c "${FILE}" | docker compose -f "${ROOT}/docker-compose.yml" exec -T \
  -e PGPASSWORD="${DB_PASSWORD}" \
  db psql -U "${DB_USERNAME}" -d "${DB_DATABASE}"

echo "Starting app..."
docker compose -f "${ROOT}/docker-compose.yml" start app 2>/dev/null || true
echo "Done."
