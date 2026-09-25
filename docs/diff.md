# Host-side diff: simplified composition editor

Packages: `blob-editor-ts` (npm `blob-editor`) and `blob_editor_flutter`.
Quick-edit only — image ⊃ gif ⊃ video. Complicated edits go elsewhere.

---

## Feature matrix (kind-gated UI)

| Feature | Image | GIF | Video |
|---------|:-----:|:---:|:-----:|
| Crop, scale, rotate, text overlays, undo/redo | yes | yes | yes |
| Canvas BG color / transparent | yes | yes | **no** |
| Brush + polygon mask cutout | yes | no | no |
| White sticker border | yes | no | no |
| Multi objects on canvas (images + GIFs) | yes | yes | **no** |
| Trim start / end | — | yes | yes |
| Mute original sound | — | — | yes |

**Cutout:** user paints add/remove brush strokes and/or a polygon keep-region on the stage. Editor stores `mask_asset_id` (alpha). **Apply mask** commits the session. No in-package ML / auto remove-BG. No greenscreen/chroma.

---

## 1. Document JSON (v2, simplified)

| Field | Notes |
|-------|--------|
| `version` | `2` (v1 accepted and migrated) |
| `duration_ms` | `0` static; ≤ **10000** for gif/video after trim |
| `fps` | Encode/scrub hint (default 15 GIF / 24 video) |
| `audio` | `null` or `{ "mute_source": boolean }` — video only |
| `objects[].media.kind` | `"image" \| "gif" \| "video"` |
| `objects[].media.keep` | **Single** `{ start_ms, end_ms } \| null` — trim only |
| `objects[].media.mask_asset_id` | Cutout alpha (images only) |
| `objects[].media.outline` | `{ color, width } \| null` — sticker border (images only) |
| `objects[].media.crop` / `transform` | As before |

**Removed (migrate strips / ignores):**

- `chroma` / greenscreen
- Multi-range `keep[]` concat / cut-middle (collapse to first range)
- `TextObject.keep` timed visibility
- `audio.soundtrack_asset_id`, `audio.keep`, `audio.gain`
- `media.timing` (v1) → single `keep`

**Validation rules hosts should expect:**

- Video → canvas background must **not** be `"transparent"` (opaque `#RRGGBB`)
- Video → at most **one** media object, `kind === "video"` (no video overlays)
- Outline / mask only meaningful on `kind === "image"`
- Trim: `end_ms > start_ms`

---

## 2. Drop-in editor hooks

`onExport` returns **document + still PNGs** (chat 128 / thumbnail 256 / full 1024). Optional `mask` when cutout used.

```ts
{
  document: CompositionDocument;
  exports: { chat: Blob; thumbnail: Blob; full: Blob };
  mask?: Blob;
  meta?: {
    background: "transparent" | `#${string}`;
    width: 1024;
    height: 1024;
    mimeType?: string;
    duration_ms?: number;
    has_audio?: boolean; // false when mute_source or no soundtrack path
  };
}
```

**Flutter / web do not encode GIF/MP4.** App uploads assets + composition; server encodes.

---

## 3. Server encode

```ts
import { encodeComposition } from "blob-editor/encode";
import { validateDocument } from "blob-editor/core";

const doc = validateDocument(revision.document_json);
const result = await encodeComposition(doc, frameResolver, bytesResolver);
```

| Output | When |
|--------|------|
| `chat` / `thumbnail` / `full` | Always PNG |
| `mask` | Image cutout mask / outline present |
| `gif` | `duration_ms > 0` and media `kind === "gif"` |
| `video` | video kind; ≤10s square mp4; respects `mute_source` |

Do **not** mux a replacement soundtrack in this pass.

**Preview ≡ encode** via `renderFrame` / Flutter paint. Do not reimplement draw on the server.

---

## 4. Asset roles

| Role | Notes |
|------|--------|
| Primary / overlay media | image / gif / video originals |
| Mask | Brush / polygon cutout alpha; `mask_asset_id` |

No soundtrack asset role in this simplified pass.

---

## 5. Caps

- Canvas: **1024×1024**
- Animated duration: **≤ 10 000 ms** after trim
- Still derivatives: chat / thumbnail / full
- Remix: `remixDeepCopy` (document + same asset ids)

---

## 6. What hosts do **not** need

- Greenscreen / chroma UI or fields
- Soundtrack attach / gain / ducking
- Multi-segment keep / cut-middle timeline
- Timed text visibility windows
- Expecting local mp4/gif from the Flutter or React drop-in
- Host auto remove-BG callback (cutout is brush + polygon in-editor)

---

## 7. Package import map (TS)

```ts
import { validateDocument, renderFrame, renderExports } from "blob-editor/core";
import { BlobEditor } from "blob-editor/react";
import { encodeComposition } from "blob-editor/encode"; // Node worker only
```

Do not bundle `blob-editor/encode` into the browser.

---

## 8. Editor chrome (TS React)

Drop-in shell groups related controls into **tool categories** with a **collapsible submenu** (reduces clutter).

| Region | Role |
|--------|------|
| **Header** | Cancel (optional), Undo, Redo, Export |
| **Tool nav** | Categories: Transform, Crop, Cutout, Text, Canvas — only those available for current selection / kind |
| **Tool panel** | Collapsible submenu for the active category; tap same nav item or Close to collapse |
| **Stage** | Square canvas; brush/polygon interact here when Cutout is active |
| **Timeline** | Under the stage when `duration_ms > 0` (GIF/video); not inside the tool panel |
| **Previews** | Export sizes (chat / thumb / full) |

**Responsive** (`@container` ≥720px):

- **Narrow:** header → previews → stage → timeline (if any) → collapsible panel → bottom category nav
- **Wide:** header; body = tool nav + panel (left) \| stage + timeline (center) \| previews (right)

---

## 9. TS vs Flutter backlog

Flutter cutout + shell parity landed. Matrix below is the post-parity status:

| Item | TS (`blob-editor`) | Flutter |
|------|--------------------|---------|
| Stage shows live mask | Composed crop+mask on Konva stage | Yes (`paintComposition`) |
| Brush disables pan/drag | Yes | Yes (gesture short-circuit) |
| Brush size slider | Yes (8–64) + cursor preview | Yes (8–64) + stage cursor |
| Pen / masking cursor | `crosshair` + stage chrome | Precise cursor + brush ring |
| Crop sliders | Yes | Yes (Crop category) |
| Apply mask control | Explicit button (commit + exit tool) | Yes |
| Auto remove-BG UI | **Removed** | **Removed** (brush + polygon only) |
| Polygonal mask | Yes (points → keep region; intersects existing) | Yes |
| Outline width slider | Yes | Yes (2–32) |
| Export `mask` blob | Wired via `renderMaskBlob` | Wired via `renderMaskPng` |
| **Tool categories + collapsible submenu** | Header / ToolNav / ToolPanel | Header / ToolNav / ToolPanel |
| Narrow layout | Previews top; panel above bottom nav | Same order |
| Wide layout | Tools left \| stage \| previews right | Same; needs bounded height from host |
