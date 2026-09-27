# Docker

`docker compose up -d --build` starts the Next.js app (+ worker WSS), Postgres, Meilisearch, and daily DB backups.

Remote encode workers use a **separate** compose file and env — see [Worker compose](#worker-compose) below.

## Services

| Service | Role |
|---------|------|
| `app` | Next.js + worker WSS (`tsx server.ts` on :3000), runs `prisma migrate deploy` on boot |
| `meilisearch` | Keyword + hybrid + multimodal search (v1.16+) |
| `db` | Postgres 16 |
| `pgbackups` | Daily gzipped dumps into `./storage/backups/postgres/` (14 days) |

Host ports (from `.env`):

- App: `APP_PORT` → container 3000 (default 8080)
- Meili: `MEILI_PUBLISH_PORT` → 7700 (default 7700)
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
- Search: `MEILI_HOST`, `MEILI_MASTER_KEY` (required for compose `meilisearch`), optional `MEILI_SEARCH_KEY`
- Ollama: `OLLAMA_BASE_URL`, optional `OLLAMA_API_KEY` (required if using `docker-compose.proxy.yml` / `ollama-auth-proxy`), `OLLAMA_EMBED_MODEL`, `OLLAMA_VISION_MODEL`, `OLLAMA_AGENT_MODEL`
- Multimodal CLIP REST (self-hosted beside Ollama): `MEILI_MULTIMODAL_URL`, `MEILI_MULTIMODAL_MODEL`, optional `MEILI_MULTIMODAL_API_KEY`

### Self-hosted CLIP (`docker-compose.clip.yml`)

Meilisearch multimodal calls OpenAI-shaped `POST /v1/embeddings`. This repo ships a small OpenCLIP server under `clip-server/` — run it on the **same GPU host as Ollama** (not on the blob app host unless that machine has the GPU).

```bash
# On the Ollama / GPU machine
cp .env.clip.example .env.clip
docker compose -f docker-compose.clip.yml up -d --build
curl -s http://127.0.0.1:8081/health
```

Needs [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html). For CPU-only testing set `CLIP_DEVICE=cpu` in `.env.clip` (slow).

Put TLS in front (Caddy/nginx) like Ollama, e.g. `https://clip.mamajees.com`, then on the **blob** `.env`:

```bash
MEILI_MULTIMODAL_URL=https://clip.mamajees.com   # no path; app appends /v1/embeddings
MEILI_MULTIMODAL_MODEL=openclip-vit-b-32         # must match CLIP_MODEL_ID
# MEILI_MULTIMODAL_API_KEY=...                  # same as CLIP_API_KEY if set
```

Default weights are `ViT-B-32` / `laion2b_s34b_b79k` (~1–2GB VRAM). Idle unload (`CLIP_IDLE_UNLOAD_SECONDS=300`) frees the 1060 for Ollama. Meili must reach the CLIP URL **and** sticker `previewUrl`s (`AUTH_URL`) when indexing images. Without `MEILI_MULTIMODAL_*`, keyword + Ollama text hybrid still work; Image mode stays off.

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
