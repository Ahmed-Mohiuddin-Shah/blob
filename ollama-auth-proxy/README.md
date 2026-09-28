# Ollama auth proxy + host tuning

`proxy.js` is a small Bearer-key gate in front of local Ollama (see repo root `docker-compose.proxy.yml`).

On the **GPU machine that runs Ollama**, use `configure-ollama.sh` to set keep-alive / parallelism and restart.

## Why

| Env | Purpose |
|-----|---------|
| `OLLAMA_KEEP_ALIVE` | How long a model stays loaded after idle. Default is ~5m. Use `30m` or `-1` (never unload until OOM/restart). |
| `OLLAMA_NUM_PARALLEL` | Max concurrent generations on the server. `1` queues requests so several blob workers do not thrash a small GPU. |

**Note:** 4 workers with `--concurrency 1` still means up to 4 parallel jobs. Cap with `OLLAMA_NUM_PARALLEL=1` and/or run fewer workers during search enrich.

## Configure & restart

From this folder on the Ollama host:

```bash
chmod +x configure-ollama.sh

# defaults: KEEP_ALIVE=30m, NUM_PARALLEL=1 → systemd drop-in + restart
./configure-ollama.sh

# never unload; single-flight requests
./configure-ollama.sh --keep-alive -1 --num-parallel 1

# allow 2 in parallel, keep 30 minutes
./configure-ollama.sh --keep-alive 30m --num-parallel 2

# also write a sourced env file (manual `ollama serve`)
./configure-ollama.sh --keep-alive -1 --num-parallel 1 --env-file ~/.ollama-serve.env

# preview only
./configure-ollama.sh --keep-alive -1 --num-parallel 1 --dry-run
```

Env vars work as defaults too:

```bash
OLLAMA_KEEP_ALIVE=-1 OLLAMA_NUM_PARALLEL=1 ./configure-ollama.sh
```

### systemd (official `ollama` package)

Script writes:

`/etc/systemd/system/ollama.service.d/blob-tuning.conf`

then `daemon-reload` + `restart ollama` (uses `sudo` if needed).

### Manual `ollama serve`

If there is no `ollama.service`:

```bash
export OLLAMA_KEEP_ALIVE=-1
export OLLAMA_NUM_PARALLEL=1
# stop old serve, then:
ollama serve
```

Or:

```bash
set -a && source ~/.ollama-serve.env && set +a
ollama serve
```

### Pin a model loaded now

After restart (optional warm):

```bash
curl http://127.0.0.1:11434/api/chat -d '{
  "model": "qwen2.5vl:3b",
  "keep_alive": -1,
  "stream": false,
  "messages": [{"role": "user", "content": "hi"}]
}'
```

## Auth proxy (Blob → Ollama)

```bash
cp .env.proxy.example ../.env.proxy   # from repo root, or adjust path
# set OLLAMA_PROXY_API_KEYS=...
docker compose -f docker-compose.proxy.yml up -d --build
```

Point Blob / workers at the proxy (`OLLAMA_BASE_URL` + `OLLAMA_API_KEY`), not raw `:11434` on the public net.
