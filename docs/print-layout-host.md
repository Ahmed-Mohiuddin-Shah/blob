# Print layout — host integration (BLOB web + app)

How BLOB should use the portable packages for **interactive sticker sheets**. Composition (`BlobEditor`) stays the 1024² sticker editor; print is a sibling surface.

**Glossary:** a **Sticker Sheet** is a single printable page (one PDF page or one sheet image/PNG). A **Sticker Pack** is a bundle of multiple sheets/PDFs. `PrintLayout` is the geometry UI used to compose sheets.

## When to use which

| Goal | Package UI | Document |
|------|------------|----------|
| Create / remix one sticker | `BlobEditor` | Composition v2 (1024×1024) |
| Lay stickers on a printable page | `PrintLayout` | PrintDocument v1 (mm page) |

Do **not** put A4 into `BlobEditor`. Do **not** edit composition cutouts inside `PrintLayout`.

## Architecture

```
User → PrintLayout (web React / Flutter)
         │  document JSON (asset_id refs only)
         │  preview PNG
         ▼
BLOB host  →  resolve sticker full PNGs via Glass / MediaStorage
         │
         ▼
Worker: encodePrint(doc, bytesResolver) → PNG sheet + PDF (embedded sources)
         │
         ▼
GLASS cache (generated_prints)
```

Packages never import glass-ts. Host owns upload/download and id → bytes.

## PrintDocument (v1)

```json
{
  "version": 1,
  "page": {
    "width_mm": 210,
    "height_mm": 297,
    "margin_mm": { "top": 10, "right": 10, "bottom": 10, "left": 10 },
    "background": "#FFFFFF",
    "cut_marks": true
  },
  "items": [
    {
      "id": "item_…",
      "asset_id": "glass-or-sticker-png-key",
      "x_mm": 12,
      "y_mm": 20,
      "width_mm": 40,
      "rotation_deg": 0
    }
  ]
}
```

- **mm** is the source of truth (scales to any metric size).
- Presets in packages: `pageA4()`, `pageA5()`, `pageCustom(w, h)`.
- `asset_id` is a **generic string**. Map each pack sticker’s published **full PNG** (1024) to that id when resolving.
- Height follows source aspect (square stickers → height = width).

Ops (both packages): `addPrintItem`, `movePrintItem`, `resizePrintItem`, `rotatePrintItem`, `removePrintItem`, `layoutGrid(assetIds, page, { rows, columns, gap_mm })`.

## React (npm `blob-editor`)

```tsx
import { PrintLayout } from "blob-editor/react";
import "blob-editor/react/blob-editor.css";
import {
  validatePrintDocument,
  layoutGrid,
  pageA4,
} from "blob-editor/print";

<PrintLayout
  assets={stickers.map((s) => ({
    id: s.fullAssetId,       // same id used in PrintDocument
    label: s.title,
    thumbUrl: s.thumbnailUrl,
  }))}
  resolveAsset={async (id) => loadImage(await fetchPngUrl(id))}
  document={savedPrintJson}  // optional edit
  themeMode="system"
  onExport={({ document, previewPng }) => {
    // POST document + preview; enqueue worker encodePrint for PDF
  }}
  onCancel={() => {}}
/>
```

Core-only (no React): `import { … } from "blob-editor/print"`.

## Flutter (`blob_editor`)

```dart
PrintLayout(
  assets: [
    for (final s in stickers)
      PrintAssetMeta(id: s.fullAssetId, label: s.title),
  ],
  resolveAsset: (id) async => decodePng(await mediaStorage.download(id)),
  document: savedPrintJson, // Map?
  onExport: (payload) {
    // payload.document.toJson(), payload.previewPng
  },
  onCancel: () {},
);
```

Flutter exports **preview PNG only**. PDF is produced by the Node worker.

## Worker encode (Node)

```ts
import { encodePrint } from "blob-editor/encode";
import { validatePrintDocument } from "blob-editor/print";

const doc = validatePrintDocument(body.document);
const result = await encodePrint(doc, async (assetId) => {
  return mediaStorage.getBytes(assetId); // sticker full PNG
}, { dpi: 150, formats: ["png", "pdf"] });

// result.exports.png — raster sheet (optional download)
// result.exports.pdf — page in mm with **embedded source PNGs** (print quality)
```

Requires optional dependency `pdf-lib` on the worker. Do **not** bundle `blob-editor/encode` into the browser.

## Combine multi-sheet packs (Node)

When a pack spans several print pages (or several saved sheets), merge in the worker:

```ts
import { combinePdfs, combinePngsGrid, evenGridDims } from "blob-editor/encode";

// PDF: append pages (each encodePrint PDF is typically one page)
const packPdf = await combinePdfs([page1Pdf, page2Pdf, page3Pdf]);

// PNG: pack sheet previews into a near-square contact sheet
// evenGridDims(5) → { rows: 2, columns: 3 }
const packPng = await combinePngsGrid([page1Png, page2Png, page3Png], {
  gapPx: 8,
  background: "#FFFFFF",
  // cellPx / rows / columns optional overrides
});
```

`combinePngsGrid` uses `ceil(sqrt(n))` columns so the grid stays as square as possible; leftover cells stay empty.

## Suggested persistence (BLOB)

Aligned with existing prints domain; interactive layout is an extra SoT:

| Concept | Suggestion |
|---------|------------|
| Pack | `sticker_packs` + `pack_stickers` (ordered sticker ids) |
| Page preset / grid default | `print_layouts` (mm, rows, cols) → seed `layoutGrid` |
| User/admin free layout | Store `print_document_json` (PrintDocument) on the pack revision or a print-session row |
| Output | `generated_prints` — cache PNG+PDF in GLASS; `cache_key` = hash(doc + asset content revisions + dpi + formats) |

Generate on demand; do not precompute every pack×layout.

## Host checklist

1. Build sticker PNGs via composition editor + existing encode (already true).
2. Pack UI lists stickers → open `PrintLayout` with their full PNG asset ids.
3. On export: save PrintDocument; upload preview if useful; enqueue `encodePrint`.
4. Serve PDF download from GLASS (private prism + signed URL unless pack is public).

## Non-goals (packages)

- glass-ts / Prisma / Next routes inside `blob-editor`
- Video/GIF on the print page (PNG stickers only)
- Composition editing inside PrintLayout
