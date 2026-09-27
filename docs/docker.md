# Docker

`docker compose up -d --build` starts the Next.js app (+ worker WSS), Postgres, and daily DB backups.

Remote encode workers use a **separate** compose file and env — see [Worker compose](#worker-compose) below.

## Services

| Service | Role |
|---------|------|
| `app` | Next.js + worker WSS (`tsx server.ts` on :3000), runs `prisma migrate deploy` on boot |
| `db` | Postgres 16 |
| `pgbackups` | Daily gzipped dumps into `./storage/backups/postgres/` (14 days) |

Host ports (from `.env`):

- App: `APP_PORT` → container 3000 (default 8080)
- DB: `DB_PUBLISH_PORT` → 5432 (default 5433)

## Env

Copy `.env.example` → `.env`. Required:

- `DATABASE_URL` (compose overrides host to `db` for the app service)
- `SESSION_SECRET`, `AUTH_URL`
- `ZITADEL_DOMAIN`, `ZITADEL_CLIENT_ID`, `ZITADEL_CLIENT_SECRET`
- `ZITADEL_POST_LOGOUT_URL`
- `ZITADEL_SERVICE_PAT`, `ZITADEL_ORG_ID`, `ZITADEL_PROJECT_ID` (Management API)
- For Glass uploads: `GLASS_API_URL`, `GLASS_API_KEY` (public PRISM is created by the app into `public_prism`)
- Optional: `WORKER_LEASE_SECONDS` (default 120) — how long a claimed job stays leased before reclaim

Zitadel app settings (must match exactly):

- Redirect URI: `{AUTH_URL}/api/auth/callback/zitadel`
- Post-logout URI: `{AUTH_URL}/api/auth/logout/callback`
- Auth method: Authorization Code + PKCE (Web)

Login page: `/auth/login` (CSRF form → Zitadel). Logout: `POST /api/auth/logout`.

## Backups

Automatic daily via `pgbackups`. Files land under:

```
storage/backups/postgres/daily/
storage/backups/postgres/last/
```

## Restore

```bash
npm run db:restore
# or
npm run db:restore -- ./storage/backups/postgres/daily/blob-YYYYMMDD.sql.gz
```

Prompts for `yes`, stops `app`, pipes the dump into `db`, starts `app` again.

```bash
gunzip -c storage/backups/postgres/last/blob-latest.sql.gz \
  | docker compose exec -T db psql -U "$DB_USERNAME" -d "$DB_DATABASE"
```

## Worker compose

On a machine that only runs an encode worker (outbound WSS + GLASS; no public ports):

```bash
cp .env.worker.example .env.worker
# set BLOB_URL, WORKER_API_KEY (from /profile/workers), GLASS_API_URL, GLASS_API_KEY
docker compose -f docker-compose.worker.yml up -d --build
```

Or locally against a running app:

```bash
npm run worker
```

Workers connect to `wss://<BLOB_URL host>/api/workers/ws`. Mint keys as superadmin at `/profile/workers`. If no capable worker is online, the app falls back to single-flight in-process encode.

## Local without Docker app

```bash
docker compose up -d db pgbackups
npm install
npx prisma migrate deploy
npm run dev
```

Use `DATABASE_URL` pointing at `localhost:${DB_PUBLISH_PORT}`. `npm run dev` / `npm run start` use the custom server (Next + worker WSS).

## Prisma P3005 (schema not empty)

After the Laravel → Next cutover, the old Postgres volume still has Laravel tables and no `_prisma_migrations` history. Fresh migrate then fails with **P3005**.

Wipe the volume and remigrate (destroys DB data):

```bash
npm run db:reset
# or:
docker compose down
docker volume rm blob_blob_pgdata   # name from: docker volume ls | grep blob
docker compose up -d --build --remove-orphans
```

Or only drop schema (keeps volume):

```bash
docker compose exec db psql -U "$DB_USERNAME" -d "$DB_DATABASE" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
docker compose restart app
```
