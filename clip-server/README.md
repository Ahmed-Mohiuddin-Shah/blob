# blob-clip

Tiny OpenCLIP HTTP server for Meilisearch multimodal search.

- `GET /health`
- `POST /v1/embeddings` — OpenAI-shaped; `input` as string, string[], or `[{text|image}]`

Run via repo root:

```bash
cp .env.clip.example .env.clip
docker compose -f docker-compose.clip.yml up -d --build
```

See root [README.md](../README.md) end-to-end search setup.
