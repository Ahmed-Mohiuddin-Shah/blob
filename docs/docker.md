# Docker

`docker compose up -d --build` starts the Next.js app, Postgres, and daily DB backups.

## Services

| Service | Role |
|---------|------|
| `app` | Next.js (`next start` on :3000), runs `prisma migrate deploy` on boot |
| `db` | Postgres 16 |
| `pgbackups` | Daily gzipped dumps into `./storage/backups/postgres/` (14 days) |

Host ports (from `.env`):

- App: `APP_PORT` → container 3000 (default 8080)
- DB: `DB_PUBLISH_PORT` → 5432 (default 5433)

## Env

Copy `.env.example` → `.env`. Required:

- `DATABASE_URL` (compose overrides host to `db` for the app service)
- `AUTH_SECRET`, `AUTH_URL` / `NEXTAUTH_URL`
- `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_CLIENT_SECRET`
- `ZITADEL_POST_LOGOUT_REDIRECT_URI`

Zitadel app redirect URI: `{AUTH_URL}/api/auth/callback/zitadel`  
Post-logout URI: `{AUTH_URL}/auth/logout/callback`

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

Manual one-liner:

```bash
gunzip -c storage/backups/postgres/last/blob-latest.sql.gz \
  | docker compose exec -T db psql -U "$DB_USERNAME" -d "$DB_DATABASE"
```

## Local without Docker app

```bash
docker compose up -d db pgbackups
npm install
npx prisma migrate deploy
npm run dev
```

Use `DATABASE_URL` pointing at `localhost:${DB_PUBLISH_PORT}`.

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
