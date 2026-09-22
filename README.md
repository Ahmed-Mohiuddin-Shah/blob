# BLOB

Public sticker library (Next.js). Phase 1: home shell, Zitadel-only auth, profile, Prisma users.

## Stack

- Next.js (App Router) + Tailwind v4
- Auth.js + Zitadel (OIDC/PKCE, sole provider)
- PostgreSQL + Prisma
- Avatars: [blobatar](https://blobatar.dev/) from `username`

See [docs/blob-requirements.md](docs/blob-requirements.md), [docs/style-guide.md](docs/style-guide.md), [docs/docker.md](docs/docker.md).

## Quick start

```bash
cp .env.example .env   # fill AUTH_SECRET, Zitadel, DB
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
- Post-logout URI: `{AUTH_URL}/auth/logout/callback`
- Auth method: PKCE (Web)
