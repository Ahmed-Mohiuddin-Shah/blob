#!/usr/bin/env bash
# Wipe Postgres volume and re-apply Prisma migrations (dev / greenfield only).
# Use after Laravel→Next cutover when you see Prisma P3005 on a non-empty DB.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "This deletes the blob_pgdata volume (all DB data)."
read -r -p "Type 'yes' to continue: " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi

docker compose stop app 2>/dev/null || true
docker compose rm -f app 2>/dev/null || true
docker compose down
docker volume rm blob_blob_pgdata 2>/dev/null || docker volume rm "$(docker volume ls -q | grep blob.*pgdata | head -1)" || true
docker compose up -d --build --remove-orphans
echo "Done. App should migrate on boot."
