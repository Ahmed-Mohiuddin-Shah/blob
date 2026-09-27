# OpenCLIP embed API for Meilisearch multimodal.
# GTX 1060-friendly: CUDA 11.8 runtime. Override CLIP_DEVICE=cpu for no-GPU hosts.
FROM pytorch/pytorch:2.1.2-cuda11.8-cudnn8-runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENV CLIP_MODEL=ViT-B-32 \
    CLIP_PRETRAINED=laion2b_s34b_b79k \
    CLIP_MODEL_ID=openclip-vit-b-32 \
    CLIP_DEVICE= \
    CLIP_IDLE_UNLOAD_SECONDS=300 \
    PYTHONUNBUFFERED=1

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=60s \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
