# blob-clip

Tiny OpenCLIP HTTP server for Meilisearch multimodal search.

- `GET /health`
- `POST /v1/embeddings` — OpenAI-shaped; `input` as string, string[], or `[{text|image}]`

Run via repo root:

```bash
cp .env.clip.example .env.clip
docker compose -f docker-compose.clip.yml up -d --build
```

Needs NVIDIA Container Toolkit (`runtime: nvidia`). If Docker errors with CDI / “no known GPU vendor”, pull latest compose files and ensure the toolkit runtime is configured:

```bash
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

CPU fallback: `CLIP_DEVICE=cpu` in `.env.clip` and `-f docker-compose.clip.cpu.yml`.

See root [README.md](../README.md) end-to-end search setup.
