# Docker

## Compose files

| File | Services | Use |
|------|----------|-----|
| `docker-compose.yml` | includes data + app | **Single box** — `docker compose up -d --build` |
| `docker-compose.data.yml` | `db`, `meilisearch`, `pgbackups` | Shared data plane (one host) |
| `docker-compose.app.yml` | `app` (+ `/api/health` healthcheck) | One or more app hosts behind a LB |
| `docker-compose.worker.yml` | encode worker | Remote workers (outbound WSS) |

```bash
# Single box (unchanged)
docker compose up -d --build

# Split hosts
docker compose -f docker-compose.data.yml up -d          # data host
docker compose -f docker-compose.app.yml up -d --build  # each app host
```

Remote encode workers use a **separate** compose file and env — see [Worker compose](#worker-compose) below.

## Services

| Service | Role |
|---------|------|
| `app` | Next.js + worker WSS (`tsx server.ts` on :3000), runs `prisma migrate deploy` on boot; heartbeats into `app_instances`; LISTEN/NOTIFY for multi-app job wakeups |
| `meilisearch` | Keyword + hybrid + multimodal search (v1.16+) — **one shared instance** for all apps |
| `db` | Postgres 16 — **one shared instance** (jobs, workers, app presence) |
| `pgbackups` | Daily gzipped dumps into `./storage/backups/postgres/` (14 days) |

Host ports (from `.env`):

- App: `APP_PORT` → container 3000 (default 8080)
- Meili: `MEILI_PUBLISH_PORT` → 7700 (default 7700)
- DB: `DB_PUBLISH_PORT` → 5432 (default 5433)

Health: `GET /api/health` on the app (db + meili status, online apps/workers, job counts). Compose `app` healthcheck curls that route. Meili/db keep their own healthchecks.

## Multi-app / load balancer

1. Run **one** data stack (`docker-compose.data.yml`) — shared Postgres + Meili.
2. Run one or more apps (`docker-compose.app.yml`) with the same `DATABASE_URL` / `MEILI_HOST` pointing at that data host (published ports or private network / tunnel).
3. Optional stable id per replica: `APP_INSTANCE_ID=app-1` (otherwise auto-generated). See `/profile/workers` → Control plane.
4. Point workers’ `BLOB_URL` at the **load balancer** (Cloudflare Tunnel LB, nginx, etc.). Workers claim via WSS; apps sync the queue through Postgres LISTEN/NOTIFY.
5. Local encode fallback runs only when **no** capable worker has a fresh DB heartbeat (not “no sockets on this process”).

## Env

Copy `.env.example` → `.env`. Required:

- `DATABASE_URL` (combined compose forces `@db:5432` for the app service)
- `AUTH_URL`
- `ZITADEL_DOMAIN`, `ZITADEL_CLIENT_ID`, `ZITADEL_CLIENT_SECRET` (optional for public PKCE)
- `ZITADEL_API_CLIENT_ID` (API app — JWT audience)
- `ZITADEL_POST_LOGOUT_URL`
- `ZITADEL_SERVICE_PAT`, `ZITADEL_ORG_ID`, `ZITADEL_PROJECT_ID` (Management API)
- For Glass uploads: `GLASS_API_URL`, `GLASS_API_KEY` (public PRISM is created by the app into `public_prism`)
- Optional: `WORKER_LEASE_SECONDS` (default 120), `WORKER_ONLINE_SECONDS` (default 45), `APP_INSTANCE_ID`
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

Needs [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html). Compose uses `runtime: nvidia` (not `gpus: all`) to avoid CDI “no known GPU vendor” failures on older toolkit setups.

If start fails with `unknown runtime nvidia` or GPU not visible inside the container:

```bash
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
# optional CDI specs (newer Docker):
# sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml
nvidia-smi   # driver ok on host?
docker compose -f docker-compose.clip.yml up -d --build
```

CPU-only (slow; no toolkit): set `CLIP_DEVICE=cpu` in `.env.clip`, then:

```bash
docker compose -f docker-compose.clip.yml -f docker-compose.clip.cpu.yml up -d --build
```

Put TLS in front (Caddy/nginx) like Ollama, e.g. `https://clip.mamajees.com`, then on the **blob** `.env`:

```bash
MEILI_MULTIMODAL_URL=https://clip.mamajees.com   # no path; app appends /v1/embeddings
MEILI_MULTIMODAL_MODEL=openclip-vit-b-32         # must match CLIP_MODEL_ID
# MEILI_MULTIMODAL_API_KEY=...                  # same as CLIP_API_KEY if set
```

Default weights are `ViT-B-32` / `laion2b_s34b_b79k` (~1–2GB VRAM). Idle unload (`CLIP_IDLE_UNLOAD_SECONDS=300`) frees the 1060 for Ollama. Meili must reach the CLIP URL **and** sticker `previewUrl`s (`AUTH_URL`) when indexing images. Without `MEILI_MULTIMODAL_*`, keyword + Ollama text hybrid still work; Image mode stays off.

Zitadel apps (same project):

- **Web** PKCE: Redirect URI `{AUTH_URL}/api/auth/callback/zitadel`; Post-logout `{AUTH_URL}/api/auth/logout/callback`
- **API**: client id → `ZITADEL_API_CLIENT_ID` (access-token `aud`)

Login: `/auth/login` → `/api/auth/signin`. Logout: `POST /api/auth/logout`.

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

Workers connect to `wss://<BLOB_URL host>/api/workers/ws`. Mint keys as superadmin at `/profile/workers`. If no capable worker has a fresh heartbeat, the app falls back to single-flight in-process encode.

## Local without Docker app

```bash
docker compose -f docker-compose.data.yml up -d
# or: docker compose up -d db meilisearch pgbackups
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
