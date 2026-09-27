"""
Minimal OpenCLIP embed server for Meilisearch multimodal (OpenAI-shaped /v1/embeddings).

Accepts:
  { "model": "...", "input": "text" }
  { "model": "...", "input": ["text", ...] }
  { "model": "...", "input": [{ "text": "..." }, { "image": "https://..." | "data:image/...;base64,..." }] }
"""

from __future__ import annotations

import base64
import io
import os
import threading
import time
from typing import Any

import httpx
import open_clip
import torch
from fastapi import FastAPI, Header, HTTPException
from PIL import Image
from pydantic import BaseModel, Field

CLIP_MODEL = os.environ.get("CLIP_MODEL", "ViT-B-32")
CLIP_PRETRAINED = os.environ.get("CLIP_PRETRAINED", "laion2b_s34b_b79k")
CLIP_MODEL_ID = os.environ.get("CLIP_MODEL_ID", "openclip-vit-b-32")
CLIP_API_KEY = os.environ.get("CLIP_API_KEY", "").strip()
CLIP_DEVICE = os.environ.get("CLIP_DEVICE", "").strip()  # cuda | cpu | auto
CLIP_IDLE_UNLOAD_SECONDS = int(os.environ.get("CLIP_IDLE_UNLOAD_SECONDS", "300"))

app = FastAPI(title="blob-clip", version="0.1.0")

_lock = threading.Lock()
_bundle: dict[str, Any] | None = None
_last_used = 0.0


def _pick_device() -> torch.device:
    if CLIP_DEVICE == "cpu":
        return torch.device("cpu")
    if CLIP_DEVICE == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError("CLIP_DEVICE=cuda but CUDA is not available")
        return torch.device("cuda")
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _load() -> dict[str, Any]:
    global _bundle, _last_used
    with _lock:
        if _bundle is not None:
            _last_used = time.time()
            return _bundle
        device = _pick_device()
        model, _, preprocess = open_clip.create_model_and_transforms(
            CLIP_MODEL,
            pretrained=CLIP_PRETRAINED,
        )
        model = model.to(device).eval()
        tokenizer = open_clip.get_tokenizer(CLIP_MODEL)
        _bundle = {
            "model": model,
            "preprocess": preprocess,
            "tokenizer": tokenizer,
            "device": device,
        }
        _last_used = time.time()
        return _bundle


def _maybe_unload() -> None:
    global _bundle
    if CLIP_IDLE_UNLOAD_SECONDS <= 0:
        return
    with _lock:
        if _bundle is None:
            return
        if time.time() - _last_used < CLIP_IDLE_UNLOAD_SECONDS:
            return
        _bundle = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


def _unload_loop() -> None:
    while True:
        time.sleep(30)
        try:
            _maybe_unload()
        except Exception:
            pass


threading.Thread(target=_unload_loop, daemon=True).start()


def _check_auth(authorization: str | None) -> None:
    if not CLIP_API_KEY:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    if authorization.removeprefix("Bearer ").strip() != CLIP_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def _load_image(ref: str) -> Image.Image:
    ref = ref.strip()
    if ref.startswith("data:"):
        # data:[mime];base64,<payload>
        try:
            header, b64 = ref.split(",", 1)
        except ValueError as e:
            raise HTTPException(400, f"Bad data URL: {e}") from e
        if ";base64" not in header:
            raise HTTPException(400, "Only base64 data URLs are supported")
        raw = base64.b64decode(b64)
        return Image.open(io.BytesIO(raw)).convert("RGB")
    if ref.startswith("http://") or ref.startswith("https://"):
        try:
            with httpx.Client(timeout=30.0, follow_redirects=True) as client:
                res = client.get(ref)
                res.raise_for_status()
                return Image.open(io.BytesIO(res.content)).convert("RGB")
        except Exception as e:
            raise HTTPException(400, f"Failed to fetch image: {e}") from e
    raise HTTPException(400, "image must be https URL or data: URL")


def _normalize_items(raw: Any) -> list[dict[str, str]]:
    """Turn OpenAI / Meili fragment shapes into [{text|image}, ...]."""
    if raw is None:
        raise HTTPException(400, "input is required")

    # Meili sometimes nests { input: [...], model } as the fragment
    if isinstance(raw, dict) and "input" in raw and (
        "text" not in raw and "image" not in raw
    ):
        raw = raw["input"]

    if isinstance(raw, str):
        return [{"text": raw}]

    if isinstance(raw, dict):
        if "text" in raw or "image" in raw:
            return [raw]  # type: ignore[list-item]
        raise HTTPException(400, "object input needs text or image")

    if isinstance(raw, list):
        out: list[dict[str, str]] = []
        for item in raw:
            if isinstance(item, str):
                out.append({"text": item})
            elif isinstance(item, dict):
                if "text" in item:
                    out.append({"text": str(item["text"])})
                elif "image" in item:
                    out.append({"image": str(item["image"])})
                else:
                    raise HTTPException(400, "each input item needs text or image")
            else:
                raise HTTPException(400, "invalid input item")
        return out

    raise HTTPException(400, "unsupported input type")


@torch.inference_mode()
def _embed_items(items: list[dict[str, str]]) -> list[list[float]]:
    b = _load()
    model = b["model"]
    preprocess = b["preprocess"]
    tokenizer = b["tokenizer"]
    device = b["device"]
    vectors: list[list[float]] = []

    for item in items:
        if "text" in item:
            tokens = tokenizer([item["text"]]).to(device)
            feats = model.encode_text(tokens)
        else:
            img = _load_image(item["image"])
            tens = preprocess(img).unsqueeze(0).to(device)
            feats = model.encode_image(tens)
        feats = feats / feats.norm(dim=-1, keepdim=True)
        vectors.append(feats[0].detach().float().cpu().tolist())
    return vectors


class EmbedBody(BaseModel):
    model: str | None = None
    input: Any = Field(..., alias="input")

    model_config = {"populate_by_name": True}


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "model_id": CLIP_MODEL_ID,
        "open_clip": CLIP_MODEL,
        "pretrained": CLIP_PRETRAINED,
        "device": str(_pick_device()),
        "loaded": _bundle is not None,
    }


@app.post("/v1/embeddings")
def embeddings(
    body: EmbedBody,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _check_auth(authorization)
    items = _normalize_items(body.input)
    if not items:
        raise HTTPException(400, "empty input")
    try:
        vecs = _embed_items(items)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"embed failed: {e}") from e

    return {
        "object": "list",
        "model": body.model or CLIP_MODEL_ID,
        "data": [
            {"object": "embedding", "index": i, "embedding": v}
            for i, v in enumerate(vecs)
        ],
        "usage": {"prompt_tokens": 0, "total_tokens": 0},
    }
