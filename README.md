# BLOB

Public sticker library (Next.js). Phase 1: home shell, Zitadel-only auth (roles via Management API + claim mirror), profile edit, admin users/uploads, Glass profile uploads.

## Stack

- Next.js (App Router) + Tailwind v4
- Auth.js + Zitadel (OIDC/PKCE, sole provider; service-account PAT for roles/profile)
- PostgreSQL + Prisma
- Object storage: [glass-ts](https://www.npmjs.com/package/glass-ts)
- Avatars: [blobatar](https://blobatar.dev/) from `username`

See [docs/blob-requirements.md](docs/blob-requirements.md), [docs/style-guide.md](docs/style-guide.md), [docs/docker.md](docs/docker.md).

## Quick start

```bash
cp .env.example .env   # fill SESSION_SECRET, Zitadel, DB
docker compose up -d --build
```

Or local app + Docker DB:

```bash
docker compose up -d db
npm install
npx prisma migrate deploy
npm run dev
```

## Scripts

| Command | What |
|---------|------|
| `npm run dev` | Next dev server |
| `npm run build` / `start` | Production |
| `npm test` | Vitest (mapper unit tests) |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:restore` | Restore from `storage/backups/postgres` |

## Zitadel console

- Redirect URI: `{AUTH_URL}/api/auth/callback/zitadel`
- Post-logout URI: `{AUTH_URL}/api/auth/logout/callback`
- Auth method: Authorization Code + PKCE (Web)
- Project roles: `user`, `member`, `admin` (BLOB creates them via PAT if missing)
- Service account with PAT + org/project manager rights for Management API (`ZITADEL_SERVICE_PAT`, `ZITADEL_ORG_ID`, `ZITADEL_PROJECT_ID`)

## Glass

Set `GLASS_API_URL` and `GLASS_API_KEY`. The app creates its public PRISM on first approve and stores it in `public_prism` (not env). Members upload to a per-user private prism; admins moderate at `/profile/pending` (approve / request edit / reject). Manage users lives at `/profile/users`.

