# BLOB Sticker Library — Locked v1 Requirements

**Status:** Locked (revision: Composition editor unlock)  
**Scope:** Product and engineering requirements for BLOB v1  
**Companion schema:** `[docs/blob-schema.dbml](blob-schema.dbml)`  
**Storage contracts:** GLASS `[upload_download_api.md](/home/server/dev-drive/glass/doc/upload_download_api.md)`, `[prisms_api.md](/home/server/dev-drive/glass/doc/prisms_api.md)`

This document freezes v1. Implement against this file and the DBML. Do not reopen decisions listed under **Locked decisions** without an explicit requirements revision.

**Revision note:** Create-time `fit_mode` / pad-only upload is superseded by an **editor-required BLOB Composition** model (deterministic document → derivatives). Original binaries remain immutable; composition revisions regenerate cache. Remix deep-copies the edit document. Composition core must be extractable as npm + Flutter packages; editor UX is mobile-first.

---

## 1. Product summary

BLOB is a **public sticker library and sticker creation/browsing website** with two major areas:

1. **Library** — browse, search, filter, view, download/share stickers; members create/remix via the composition editor; admins moderate.
2. **Prints** — premade sticker packs and printable layouts; users select pack + layout and download a generated sheet (PDF/PNG).

**Stack (v1):**

- App: **Next.js** (App Router) — React Server Components for browse/detail; Client Components for composition editor, likes, admin actions
- Composition core: language-agnostic **BLOB Composition JSON**; portable module boundary for **npm** + **Flutter/Dart** packages (web Konva is viewport only)
- Styling: Tailwind CSS (Bloby / Zune; mobile-first editor chrome)
- Metadata DB: PostgreSQL (access via Prisma or equivalent typed client)
- Object storage: GLASS (via a gitsubmodule or custom npm package)
- Jobs: separate Node workers (e.g. BullMQ / Redis, or equivalent) for composition render, smart cutout, media processing, and print generation — **not** inside the Next.js request lifecycle
- Auth: Auth.js configured with **Zitadel as the sole provider** (OIDC + PKCE); no other IdPs or auth methods
- Avatars: [blobatar](https://blobatar.dev/) from `username` only (never Zitadel `picture`)
- Search: PostgreSQL full-text search + `pg_trgm` (v1); **Meilisearch planned post-v1**

Search must find what the user typed (title, aliases, tags, categories, keywords)—not unrelated results.

---



## 2. Locked decisions


| Decision                              | Lock                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorization                         | `role` + `account_status`, not `is_admin` / `is_member` booleans                                                                              |
| Identity                              | **Zitadel only** (OIDC + PKCE via Auth.js). No Credentials provider, no Google/GitHub/etc., no magic link, no local password or register form |
| Sticker media                         | `stickers` → composition + many `media_assets` (derivatives) + shared `assets` (originals); never `image_path` / `gif_path` / `video_path` columns |
| Media mutation                        | **Original binaries** are immutable after upload. **Composition document** is the editable source of truth (new revision on save). **Derivatives** (`image` / `chat` / `thumbnail` / …) are regenerable cache from the current revision — not the SoT. Metadata remains editable. |
| Composition SoT                       | Own versioned **BLOB Composition JSON** (canonical 1024×1024). Never persist Konva / Fabric / Polotno / tldraw canvas JSON as the document. |
| Editor required                       | Every create and remix goes through the composition editor. No quick `fit_mode`-only upload path. Framing = document crop/transform + canvas background (`transparent` or `#RRGGBB`). |
| Preview ≡ export                      | One composition engine / draw contract; browser preview, Flutter preview, and server derivatives share the same document semantics. |
| Preview sizes                         | Live previews and stored derivatives: **chat** 128×128, **thumbnail** 256×256, **full** (`image`) 1024×1024. |
| Remix                                 | Deep-copy source `document_json` (all edits) + reuse the same original **asset** identities. Dual provenance: set `stickers.remixed_from_sticker_id` (UI) **and** insert `composition_parents` (composition lineage). Parent later edits must not affect children (no live parent composition layers). |
| Portable packages                     | Consume published **`blob-editor`** (npm) / Flutter package — do not vend or fork. Schema + core ops + React `BlobEditor`; Node worker uses `blob-editor/encode` only (never in client bundles). Host docs: [`docs/diff.md`](diff.md), [`docs/print-layout-host.md`](print-layout-host.md). |
| Moderation previews                   | Open queues (pending / needs_edit) may show still diffs (previous vs current revision). **No** JSON document-diff UI. On **approve**, discard `media_assets` (and GLASS objects) for non-current revisions. Admin history is action + note only — no retained preview images. |
| Prints UI                             | Packs / layouts / `PrintLayout` / `encodePrint` **deferred** (schema may remain; product UI later). |
| Mobile-first editor                   | Phone / narrow viewports first-class: touch gestures, ~44px targets, no hover-only controls, bottom sheets / compact bars; three previews usable on small screens. |
| Primary category                      | One `category_id` per sticker + many tags                                                                                                     |
| Tags                                  | First-class `tags` table + pivot; not a comma string on the sticker row                                                                       |
| Storage                               | Postgres = metadata + GLASS UUIDs; binaries only in GLASS                                                                                     |
| Search v1                             | PostgreSQL FTS + `pg_trgm` (Meilisearch planned post-v1)                                                                                      |
| Prints                                | Separate domain: packs, layouts, generated_prints; generate on demand + cache                                                                 |
| Video audio                           | Optional: preserve when present; not required; do not strip by default                                                                        |
| Email verification                    | Deferred (column reserved; no v1 flow required)                                                                                               |
| Favorites / collections / tag aliases | Tables in schema; UI deferred to Should-have unless noted                                                                                     |
| Tag display names                     | Stored **ALL CAPS** on save (`ANGRY CAT`); slug remains lowercase                                                                             |
| Moderation history                    | Shared polymorphic `moderation_events` (stickers + attribution claims now; collections / packs / layouts later) |
| Attribution on upload                 | Required Yes/No; Yes requires `author_name` (label) + `source_url` (http/https)                                 |
| Attribution claims                    | Signed-in only; admin approve auto-applies proposed label+URL; approve/reject require admin note               |


---



## 3. Out of scope (v1 won’t build)

- Elasticsearch / OpenSearch (Meilisearch is the planned post-v1 search engine)
- Recommendation / AI search
- Comments, following users, chat
- Real-time notifications
- Per-event analytics (who viewed what at which millisecond)
- **Replacing the original binary** after upload (delete/reject and re-upload / remix as a new sticker if needed). Composition revisions and derivative regeneration are in scope.
- Commercial / third-party editors as document SoT (Polotno, IMG.LY CE.SDK, tldraw, Excalidraw, etc.)
- Live parent composition layers (remix must snapshot the document, not bind to upstream composition revisions)
- Composition semantics trapped only in Next.js route handlers or React components (must remain package-extractable)
- SVG print output (PDF + PNG only)
- Hardcoding every pack×layout file permanently upfront
- Any auth besides Zitadel (Credentials, social IdPs, magic links, API keys for end-user login, local password/register)

---



## 4. Actors and authorization



### 4.1 User role


| Value         | Meaning                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `user`        | Registered spectator (default after register)                           |
| `member`      | Approved contributor; may upload                                        |
| `admin`       | Moderate content and manage member-level users                          |
| `superadmin`  | Full management; sole role that may promote/demote admins               |


**Bootstrap (locked):** the first local user created on signup is assigned `superadmin` (Zitadel grant + local mirror). If an existing deployment has admins but no `superadmin`, the lowest-`id` `admin` is promoted once on sign-in.

**Role-change guards (locked):** nobody may change their own role or their own `account_status`. Only `superadmin` may change `account_status` (for others). Only `superadmin` may assign or revoke `admin` in-app. `superadmin` itself is never assignable via BLOB (UI or API) — only via Zitadel (or first-signup / one-shot bootstrap). Demoting the last `superadmin` is forbidden. Admins may only set `user` / `member` on targets that are already `user` / `member`.




### 4.2 Account status


| Value       | Meaning                                     |
| ----------- | ------------------------------------------- |
| `pending`   | Awaiting activation / member approval gate  |
| `active`    | May use role capabilities                   |
| `suspended` | Temporarily blocked from privileged actions |
| `banned`    | Permanently blocked                         |


**Upload and management require** `account_status = active` **and** an appropriate `role`. Suspended/banned users must not upload or manage content even if role remains `member`/`admin`/`superadmin` until status is restored.

### 4.3 Capability matrix


| Capability                                       | Anonymous | Registered (`user`) | Member | Admin | Super Admin |
| ------------------------------------------------ | --------- | ------------------- | ------ | ----- | ----------- |
| Browse / search public                           | Yes       | Yes                 | Yes    | Yes   | Yes         |
| Like                                             | No        | Yes*                | Yes*   | Yes*  | Yes*        |
| Download                                         | Yes†      | Yes†                | Yes†   | Yes†  | Yes†        |
| Create sticker (composition editor)              | No        | No                  | Yes    | Yes   | Yes         |
| Remix sticker (snapshot composition)             | No        | No                  | Yes    | Yes   | Yes         |
| Edit own composition (new revision)              | No        | No                  | Yes    | Yes   | Yes         |
| Edit own sticker metadata                        | No        | No                  | Yes    | Yes   | Yes         |
| Manage own uploads (metadata, soft-hide request) | No        | No                  | Yes    | Yes   | Yes         |
| Approve members (`user` ↔ `member`)              | No        | No                  | No     | Yes   | Yes         |
| Promote / demote admins (`admin` only)           | No        | No                  | No     | No    | Yes         |
| Assign `superadmin`                              | No††      | No††                | No††   | No††  | No††        |
| Moderate any sticker                             | No        | No                  | No     | Yes   | Yes         |
| Manage packs / layouts                           | No        | No                  | No     | Yes   | Yes         |


 Requires `account_status = active`.  
† Subject to sticker visibility and download policy; unlisted requires knowing the link; private only for authorized users.  
†† `superadmin` is assigned only in Zitadel (or first-signup / one-shot bootstrap), never via BLOB UI/API.

**Registration defaults (locked):** `role = user` (Zitadel grant + local mirror), `account_status = active` — except the first signup, which is `superadmin`. New accounts are registered spectators (browse, search, like, download). Upload requires an admin or superadmin to grant Zitadel `member` (or higher) via BLOB admin UI. Only a superadmin may grant `admin` in-app; additional `superadmin` grants require Zitadel. `account_status` of `suspended` or `banned` blocks likes, uploads, and management regardless of role. Use `pending` only when an admin deliberately gates an account before activation.

---



## 5. Authentication and profiles



### Must have

- Login / logout via **Zitadel only** (OIDC + PKCE through Auth.js). Auth.js must register a single Zitadel provider — no Credentials, Google, GitHub, Apple, magic-link, or other providers
- No local password hash, no email/password register or login UI, no multi-account linking
- First login upserts local `users` by `zitadel_id` (OIDC `sub`); defaults `role=user`, `account_status=active` — except the first local user, who is assigned `superadmin`. If no `superadmin` exists yet, the lowest-`id` `admin` is promoted once on sign-in (Zitadel grant + local mirror)
- **Roles:** Zitadel project roles (`user` · `member` · `admin` · `superadmin`) are source of truth. BLOB mirrors into `users.role` from OIDC claims on login. Fine-grained capabilities stay in app code (capability matrix)
- **Role / profile writes:** BLOB drives Zitadel via Management API using a service-account PAT (`ZITADEL_SERVICE_PAT` + org/project ids). Admins assign `user`/`member` in-app; only a superadmin may assign/revoke `admin` in-app. `superadmin` is never assignable via BLOB — only Zitadel (or bootstrap). Nobody may change their own role; demoting the last superadmin is forbidden. Users edit display name / email in-app. No parallel role store for writes
- Profile fields synced from Zitadel claims on login: display name, email, `email_verified_at` (never sync or display Zitadel `picture`). Users may also edit display name / email / local `username` from the BLOB profile UI
- Local `username` set on first create (URL-safe handle); editable in BLOB only (blobatar)
- Admin / superadmin: change `role` (via Zitadel user grant, subject to role-change guards). Only superadmin may change `account_status` (app DB only), and never their own
- Protect routes with Next.js middleware / server-side session checks; expose role + account_status on the session for capability gates



### Deferred

- Email verification UI/flow (keep `email_verified_at` nullable; populated from Zitadel claim)



### Avatar

User faces are **[blobatar](https://blobatar.dev/)** generated from `username` only. Do **not** store or display Zitadel `picture` / profile images (no `avatar_url` column). Sticker/media binaries still go application server → GLASS.

Auth.js establishes the app session after the Zitadel OIDC callback. Zitadel is the identity and role source; `users.role` is a local mirror for gates and queries.

---



## 6. Sticker model

A **sticker** is the primary library content object. Behind it is a **BLOB Composition** (editable recipe). Required metadata fields:

- Title, description, slug
- `created_by`, `uploaded_by` (may differ; remix sets `created_by` to remixer, retains attribution rules as product policy)
- `remixed_from_sticker_id` (nullable): set when remixed; null = original create. Complements `composition_parents`.
- Primary `category_id` (nullable until set; admins/members should set before approve)
- Tags (many)
- Alternate names / keywords (for search)
- Attribution (required on create):
  - Upload asks **Has attribution?** Yes / No
  - Yes → required `author_name` (credit label) + `source_url` (http/https)
  - No → both null
  - Optional later: `attribution` freeform, `license`, `copyright_status`
- `visibility`: `public` | `unlisted` | `private`
- `moderation_status`: `draft` | `pending_review` | `needs_edit` | `approved` | `rejected` | `hidden` | `deleted`
- `moderation_note`: current open edit-request reason (cleared on resubmit)
- `processing_status`: `processing` | `ready` | `failed`
- Aggregate counters: views, downloads, likes, shares, search_appearances

**Removed:** `fit_mode` and `pad_background` columns. Framing and empty-space fill live in the composition document (`canvas.background` + object crop/transform).

Published face of a sticker = derivatives of the composition’s **current revision**.



### Content representations

```
Sticker
  ├── remixed_from_sticker_id (optional UI provenance)
  ├── Composition → current revision (document_json) → parents (remix provenance)
  ├── assets (immutable originals referenced by document; shared across remixes)
  └── media_assets (derivatives / cache; only current revision kept after approve)
        ├── image      (full 1024×1024)
        ├── chat       (128×128)
        ├── thumbnail  (256×256)
        ├── mask       (cutout alpha when applicable)
        ├── gif        (when animation warrants)
        └── video      (≤10s square mp4 when applicable)
```

Schema kinds via `media_assets.kind`: `image` | `chat` | `thumbnail` | `mask` | `gif` | `video`. Immutable originals live in **`assets`** (not duplicated as SoT in `media_assets`). Which derived kinds are produced depends on the composition (static → image+chat+thumbnail; **gif source → gif**; **video source → video + gif** lightweight silent derivative + still previews).

---



## 7. BLOB Composition

A sticker is one published/rendered composition. The **document** stores intent (transforms, crop, text, masks, timing) — never embedded pixels or library canvas blobs.



### 7.1 Canonical document

- Coordinate system: **1024 × 1024** (1:1 square). Display viewport may be any CSS/device size; all object positions/scales/rotations are in document coordinates.
- `version` field on every document (start at `1`). Breaking changes bump version; packages validate.
- Normative sketch (fields may grow; keep backward-compatible when possible):

```json
{
  "version": 1,
  "canvas": {
    "width": 1024,
    "height": 1024,
    "background": "transparent"
  },
  "objects": [
    {
      "id": "obj_01",
      "type": "media",
      "asset_id": "…",
      "transform": { "x": 512, "y": 512, "scale_x": 0.82, "scale_y": 0.82, "rotation": 0 },
      "crop": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
      "mask_asset_id": null,
      "timing": null
    },
    {
      "id": "obj_02",
      "type": "text",
      "text": "WHAT",
      "font": "Impact",
      "font_size": 110,
      "transform": { "x": 512, "y": 150, "scale_x": 1, "scale_y": 1, "rotation": 0 },
      "style": { "fill": "#ffffff", "stroke": "#000000", "stroke_width": 12 }
    }
  ]
}
```

- `canvas.background`: `transparent` or `#RRGGBB` (user choice for empty space).
- Asset references: `asset_id` (+ checksum/mime resolved from `assets` table) — **not** base64 in the document.
- Crop is non-destructive viewport on the original asset.
- Optional `timing` / `animation` on objects reserved for GIF/video (**Should** for timeline UI; fields allowed in schema from day one).



### 7.2 Revisions and undo

- Client maintains a **local undo stack** while editing (command or document snapshots in memory).
- **Save** persists a new `composition_revisions` row (`revision` increments) with full `document_json`; sets `compositions.current_revision_id`.
- Prefer treating published revisions as immutable; do not mutate an existing revision row in place.
- Do not persist every mouse move forever as separate DB rows.



### 7.3 Remix (snapshot)

1. Load parent composition’s **current** `document_json`.
2. Deep-copy the document (`remixDeepCopy` from `blob-editor/core`) into a new sticker’s composition (revision 1). Edits are duplicated; originals stay the same `asset_id`s (from-scratch media, not flattened derivatives).
3. Dual provenance: set `remixed_from_sticker_id` on the new sticker **and** insert `composition_parents` (composition → parent composition). Provenance only — **not** live layer binding.
4. Enqueue derivative render for the new sticker.
5. Later parent saves must not change child documents.

Do **not** store objects as `type: "reference"` to a parent composition for rendering.



### 7.4 Smart cutout

First-class editor operation (image stickers only; see [`docs/diff.md`](diff.md)):

- **Brush add/remove** + **polygon keep-region** in the editor; no ML / auto remove-BG in package or host for this pass.
- Mask stored as asset / `mask_asset_id` on the media object; optional outline stroke (e.g. white border).
- Original file is never destructive-cropped; cutout is composition intent + mask asset.



### 7.5 Composition engine and previews

```
Document
   │
   ▼
Composition engine (shared draw contract)
   ├── Web preview (editor)
   ├── Flutter preview
   └── Server/worker export → media_assets
```

Editor must show three live previews of the **same** composer output:

| Label | Size | Typical use |
| ----- | ---- | ----------- |
| Chat | 128×128 | Messaging / compact |
| Thumbnail | 256×256 | Browse cards |
| Full | 1024×1024 | Detail / download still |

Do not maintain a separate “pretty preview” path that diverges from export.



### 7.6 Portable packages (extractability)

Cross-platform contract = Composition JSON **v2** + `version`. Host consumes published packages — do not vend or fork.

| Package | Entry | Role |
| ------- | ----- | ---- |
| **npm `blob-editor`** | `blob-editor/core` | Validate, ops, `remixDeepCopy`, `renderFrame` / `renderExports` |
| | `blob-editor/react` | Drop-in `BlobEditor` (+ CSS); theme via primary/secondary |
| | `blob-editor/encode` | **Node worker only** — `encodeComposition` (gif/mp4); never browser |
| | `blob-editor/print` | PrintDocument helpers — **deferred** in app UI |
| **Flutter/Dart** | `blob_editor` | Same document version; painter/render parity |

- UI chrome may differ per platform; **document + rendered pixels** must match for the same inputs.
- Host integration notes: [`docs/diff.md`](diff.md) (composition), [`docs/print-layout-host.md`](print-layout-host.md) (prints — later).



### 7.7 Mobile-first editor UX

- Touch-first: drag, pinch-to-scale, two-finger rotate; undo / redo / save reachable with thumbs.
- No hover-only affordances; minimum touch targets ~44px.
- Narrow layout: tools in bottom sheet / compact bar; object list secondary; canvas dominates the viewport.
- Three previews stacked or tabbed on small screens (not desktop-only side chrome).
- Smart cutout brushes usable with a finger; brush size prominent.
- Mobile web and Flutter meet the same UX bar; desktop may add denser panels without breaking mobile.



### 7.8 GIF / video (media layers)

Treat canvas contents as **media layers** with optional `timing` (`start` / `end`). Static images: unbounded duration. GIF/video: finite duration; timeline UI when duration is finite (**Should** for full timeline; architecture reserved in Must). Keyframe animation is **Should**.

---



## 8. Create / composition lifecycle



### 8.1 Flow

```
Member opens composition editor (create or remix)
        ↓
Upload original file(s) → validate MIME, magic bytes, size, dimensions, duration, frames
        ↓
Store immutable asset(s) in GLASS + `assets` rows (private prism while pending)
        ↓
Edit document in editor (crop/transform/text/cutout/background); live chat/thumbnail/full previews
        ↓
Save → sticker + composition + composition_revision (document_json)
        + metadata (attribution, tags, …)
        moderation_status=pending_review, processing_status=processing
        ↓
Enqueue render job (composition engine → derivatives)
        ↓
Worker: render full/chat/thumbnail (+ gif/video/mask as required), strip EXIF on public outputs
        ↓
Upload derived media_assets; processing_status = ready | failed
        ↓
Admin reviews → approved | needs_edit | reject (purge) | …
        ↓
On approve + public: link public-facing assets to app-owned public PRISM
```

Create/save **must not** block the HTTP request on FFmpeg / heavy segmentation / full export. Show “Processing…” while `processing_status = processing`.



### 8.2 Square standardization

All stickers are **1:1 square**. Canonical document is **1024×1024**. The user chooses how content fills the square (transform/crop) and whether empty space is **transparent** or a **solid color**. Do not apply a silent center-crop outside the editor.



### 8.3 Edit rules (locked)


| What                                                                  | When editable                                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Original `assets` binaries                                            | **Create/upload only** — immutable afterward                                               |
| Composition document                                                  | New **revision** on save (create and post-create); owner for own stickers; admin as needed |
| Derived `media_assets`                                                | Regenerated from current revision (cache); not hand-edited                                 |
| Title, description, tags, category, visibility, attribution, keywords | After create: owner (member) for own stickers; admin for any — subject to moderation rules |
| Replacing original binary                                             | **Out of scope** — reject/delete and create/remix anew if needed                         |


Metadata edits: client → Next.js Route Handler / Server Action → PostgreSQL.  
New binaries: client → Route Handler → GLASS → `assets` UUID in Postgres.  
Composition save: client → API → `composition_revisions` + enqueue render. Web (npm) and Flutter clients call the **same HTTP API**. User faces use blobatar(`username`), not GLASS or Zitadel pictures.

---



## 9. Media rules



### 9.1 Video

- Max duration: **10 seconds**
- Audio: optional; **preserve when present**
- Square output; standardized codec/container (**mp4**)
- Always generate still previews (`thumbnail` / `chat` / `image` as applicable) for cards
- Enforce file size and resolution caps (configure in app; document in env)



### 9.2 GIF

- Enforce max dimensions, frame count, file size, processing timeout, output size
- Prefer lightweight preview for browse grids (`thumbnail` / `chat`); retain downloadable GIF when that is the deliverable
- Do not load dozens of full-size animated GIFs on a browse page without thumbnails



### 9.3 Trust and safety for files

- Validate declared MIME **and** file signatures
- Enforce size / resolution / duration / frame / timeout / worker memory / queue concurrency limits
- Strip unnecessary EXIF/metadata from **generated public** assets
- Process in isolated queue workers, not the Next.js Node process that serves HTTP



### 9.4 Original retention and reprocess

Keep **originals** in `assets` → GLASS whenever legally/technically appropriate. Admins may **reprocess** derivatives from the sticker’s **current composition revision** + referenced originals when a rendering bug is fixed (`POST /api/stickers/{id}/reprocess`). Reprocess must not invent framing outside the stored document.

---



## 10. Moderation

Creates are **not** immediately public library content.

```
Member saves composition → pending_review → Admin → approved | needs_edit | reject (purge)
needs_edit → owner or admin edits metadata and/or composition (new revision) → pending_review
```

Admins can: approve, **request edit** (required note/reason), reject (hard purge), hide, soft-delete (`moderation_status = deleted`), edit metadata, change tags/category, change ownership (`created_by` / `uploaded_by`).

**Reject (locked):** delete sticker-linked media objects from GLASS as required, then delete the local sticker row (cascades composition, media, tag pivots). Shared `assets` retained if still referenced by other compositions; otherwise eligible for GC. Record a `rejected` row in `moderation_events` before purge so history survives. Soft `rejected` status is not retained for this action.

**Edit request:** set `moderation_status = needs_edit` and `moderation_note`. Owner or admin may edit metadata and/or composition (new revision). On save from `needs_edit`, status returns to `pending_review` and note clears (`resubmitted` event).

**Still previews in open queues:** pending / needs_edit / approval UIs show current stills; when a newer revision exists, may show previous vs current side-by-side (stills only — no JSON diff). **On approve:** delete derivative `media_assets` (and GLASS objects) whose `composition_revision_id` is not the current revision so prior-edit previews are not retained.

**Shared history:** all moderation actions write to polymorphic `moderation_events` (`subject_type` + `subject_id`, no subject FK). History UI is **action + note + actor + time** (and subject title/link when the subject still exists) — **no** embedded preview images. Stickers and attribution claims use it now; collections, sticker packs, and print layouts reuse the same table when those domains gain moderation.

### 10.1 Attribution claims

Signed-in users may **claim attribution** on any sticker they can view:

- Reason: `missing` | `mislabeled`
- Required: contact name/email, proposed credit label (`proposed_author_name`), proposed source URL, short message that this is theirs
- One **pending** claim per user per sticker
- Admin queue at profile **Claims** (facets: reason, status)
- Approve / reject both require an admin note
- **Approve auto-applies** `proposed_author_name` → `author_name` and `proposed_source_url` → `source_url` on the sticker
- Events: `claim_submitted` / `claim_approved` / `claim_rejected` with `subject_type = attribution_claim`

Cards and detail show credit label (linked to `source_url` when set) plus an info popover. Remix lineage (“Remixed from”) is complementary provenance, not a substitute for attribution.

Public browse/search includes only stickers that are:

- `moderation_status = approved`
- `processing_status = ready`
- `visibility = public`

Unlisted: reachable by direct link when approved+ready; excluded from search/browse listings.  
Private: only owner after approve; admins may view only while pending review or needs edit (not after approve).

---



## 11. Search

First-class feature. Index / query against:

- Title, description
- Tags (+ aliases when implemented)
- Category name
- Author (username / display_name / author_name)
- Alternate names, keywords



### v1 engine

- PostgreSQL full-text search (`tsvector` / `search_vector` on stickers, maintained by app or trigger)
- `pg_trgm` for fuzzy / partial match
- Ranking: relevance, then popularity (`likes_count` / `downloads_count`), then recency (`published_at` / `created_at`)

Tag alias expansion in query planning is **Should-have** (table exists in schema).



### Planned: Meilisearch (post-v1)

Meilisearch is the intended next search engine (replaces or augments PG FTS). Same field contract: title, aliases, tags, categories, keywords, author. Tag **display** names stay ALL CAPS in Postgres; search indexes treat them case-insensitively. Sync/index workers are out of scope for v1.

---



## 12. Tags and categories

**Categories** — controlled hierarchy (admin-managed): e.g. Memes, Reactions, Animals, People, Gaming, Anime, Movies, Internet, Miscellaneous.

**Tags** — free-form descriptive labels; own table; sticker↔tag pivot. On save, normalize display `name` to **ALL CAPS** (e.g. `angry cat` → `ANGRY CAT`); `slug` stays lowercase (`angry-cat`).

Do not store tags as a comma string on the sticker row.

---



## 13. Likes, favorites, collections


| Feature     | Semantics              | v1                                              |
| ----------- | ---------------------- | ----------------------------------------------- |
| Like        | “I like this”          | **Must** — UI + `sticker_likes` + `likes_count` |
| Favorite    | “Save to find again”   | Schema **Must**; UI **Should**                  |
| Collections | User lists of stickers | Schema **Must**; UI **Should**                  |


Likes and favorites are distinct tables.

---



## 14. Prints domain

**Deferred for product UI** (schema may exist; do not ship PrintLayout / encodePrint host flows in this pass). Treat as separate from the core sticker row when built:

```
Sticker Pack → stickers (ordered)
Print Layout → geometry template
Pack + Layout → Generated sheet (PDF | PNG) cached in GLASS
```



### Pack

Name, description, cover image (GLASS), author, ordered stickers, published flag, visibility.

### Layout

Reusable template: page size (mm), orientation, margins, rows, columns, sticker size, gaps, cut marks, background, optional `extra_params` JSON. Do not hardcode only A4 2×3.

### Generation

- Formats: **PDF** and **PNG**
- Generate **on demand**; cache by `cache_key` (hash of pack + layout + format + content revision)
- Store result in GLASS; record in `generated_prints`
- Do not pre-generate every pack×layout combination

---



## 15. Storage architecture (GLASS)

```
PostgreSQL                    GLASS
─────────────                 ─────────────────────────
users, stickers               objects (bytes)
assets        ──►             glass_object_id + glass_prism_id  (immutable originals)
media_assets  ──►             glass_object_id + glass_prism_id  (derivatives)
compositions / revisions      document_json in Postgres
packs/prints  ──►             same
public_prism  ──► (1 row)     app public PRISM UUID (created by BLOB)
users.glass_private_prism_id  per-user private PRISM
```



### MediaStorage abstraction

Application code shall depend on a **MediaStorage** interface (upload, download URL, delete/unlink), not raw GLASS HTTP scattered through controllers. GLASS is the production implementation; local/dev may use a filesystem stub behind the same interface.

### PRISM strategy (v1 lock)


| Content                                                        | PRISM                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approved **public** derived assets (and public downloads)      | **App-owned public PRISM** — BLOB creates one GLASS PRISM (`is_public: true`) via `glass-ts`, persists it in the disjoint `public_prism` table (singleton `key=default`), and caches the UUID in-process. **Do not** configure a public PRISM UUID via env. Anonymous `GET` / `HEAD` on that prism. |
| Originals, pending/rejected, **private** / **unlisted** assets | **Per-user private PRISM** — created on first upload for that user; UUID on `users.glass_private_prism_id`. Service key or signed object/PRISM JWT                                                                                                                                                  |
| Generated prints                                               | Private or public per product need; default **private** with signed download for the requester, or public if the pack is public — **lock:** use private PRISM + short-lived download JWT/path token for downloads unless pack is public, in which case the app public PRISM is allowed              |


**Public PRISM lifecycle (locked):**

1. First time BLOB needs a public prism (e.g. admin approve), call Glass `prisms.create({ label: "blob-public", is_public: true })`.
2. Insert into `public_prism` (`key` unique sentinel `"default"`, `glass_prism_id`, `label`).
3. Cache `glass_prism_id` in the app process; on restart, load from `public_prism` — never recreate if the row exists.
4. Concurrent first creates: unique on `key` wins; losers discard the race-created Glass prism or leave it unused (prefer the DB row).

Persist on every stored object reference: `glass_object_id`, `glass_prism_id`, and checksum when provided by GLASS.

Uploads use GLASS `PUT` (simple or multipart) with `prism_id` and SHA-256 checksum per GLASS contract. Never trust client-supplied object IDs without server-side upload.

---



## 16. Statistics

v1: **aggregate counters only** on `stickers` (and pack-level later if needed). No eternal per-view event log.

Increment on meaningful actions (view detail, download, like, share, search impression) with reasonable debouncing left to implementation—but do not build a full analytics warehouse.

---



## 17. API surface

Prefer **Server Components / Server Actions** for first-party UI reads and simple mutations. Expose the same domain through **Route Handlers** (`app/api/...`) as a JSON contract for uploads, composition save, likes, print generation, and any non-Next client (**npm web** and **Flutter**). Keep domain logic in shared server modules — not duplicated in pages and handlers. Composition **document ops** belong in the portable core package, not only in route handlers.

Intended HTTP API (JSON) for v1:

```
GET    /api/stickers
GET    /api/stickers/{id}
PATCH  /api/stickers/{id}          # metadata only — no media body / no original replace
GET    /api/search
GET    /api/tags
GET    /api/categories

POST   /api/assets                 # upload original → assets row + GLASS
POST   /api/stickers               # create sticker + composition revision (document_json + metadata)
POST   /api/stickers/{id}/composition   # save new revision (document_json); enqueue render
POST   /api/stickers/{id}/remix         # snapshot remix from this sticker
POST   /api/stickers/{id}/cutout        # enqueue smart-cutout / mask job (or sync small path)
POST   /api/stickers/{id}/approve
POST   /api/stickers/{id}/reject          # purge as required then delete row
POST   /api/stickers/{id}/request-edit    # body: { note } required
POST   /api/stickers/{id}/reprocess       # admin; regenerate derivatives from current composition revision + assets
POST   /api/stickers/{id}/attribution-claims  # signed-in; body: reason, contact, proposed label+URL, message
POST   /api/attribution-claims/{id}/approve   # admin; body: { note } required; auto-applies credit
POST   /api/attribution-claims/{id}/reject    # admin; body: { note } required

GET    /api/moderation/events             # admin; cursor pagination; filters subjectType/action

POST   /api/stickers/{id}/like
DELETE /api/stickers/{id}/like

GET    /api/packs
GET    /api/packs/{id}

GET    /api/prints/layouts
POST   /api/prints/generate
```

`PATCH` must reject original binary replacement. Large uploads and long-running work go through handlers that return quickly and enqueue workers.

---



## 18. Hard rules (pitfalls → requirements)

1. Retain originals in `assets` → GLASS; do not keep only processed derivatives.
2. Use `media_assets` for derivatives; never three hardcoded media path columns on `stickers`.
3. Composition **document** is the SoT for framing/edits; never store Konva/Fabric/Polotno canvas JSON as the document.
4. Remix = deep-copy document + shared asset ids + provenance rows — never live parent composition layers.
5. One composition draw contract: preview ≡ export (web / Flutter / worker).
6. Composition core must remain extractable as **npm** + **Flutter** packages; do not trap semantics in Next-only modules.
7. Editor UX is **mobile-first** (touch, large targets, no hover-only).
8. Tags are entities + pivots, not CSV strings.
9. Search must include aliases/keywords path; ship FTS+trgm first; alias table ready.
10. Never trust uploads: MIME + magic bytes + limits + worker isolation.
11. Strip EXIF from generated public assets.
12. Cap GIF/video CPU/RAM/time; set queue concurrency deliberately.
13. Ownership is explicit (`created_by` / `uploaded_by` + attribution fields).
14. Couple to GLASS only through `MediaStorage`.
15. Print sheets: on-demand + cache; no combinatorial pre-generation.

---



## 19. v1 checklist



### Must have

- [ ] Users with `role` + `account_status` (role mirrored from Zitadel)
- [ ] Zitadel-only login/logout (no other Auth.js providers), local profile (`username` / `display_name`), blobatar avatars; profile edit via Management API
- [ ] Admin member promotion (Zitadel grant via PAT) / local status management
- [ ] Public browse + search (FTS + pg_trgm)
- [ ] Stickers with tags + primary category
- [ ] `assets` + composition + composition_revisions + composition_parents tables
- [ ] Media assets derivatives: image (1024) / chat (128) / thumbnail (256) / mask / gif / video as needed
- [ ] Editor-required create path; 1024² document; background transparent|color
- [ ] Mobile-usable web composition editor (touch, three live previews)
- [ ] Remix snapshot (deep-copy + shared assets + `remixed_from_sticker_id` + `composition_parents`)
- [ ] Smart cutout (brush + polygon; no ML auto-BG)
- [ ] Consume **`blob-editor`** npm (`react` client + `encode` worker)
- [ ] Video ≤10s; audio preserved when present
- [ ] Async render/processing + admin moderation (approve / request-edit / purge-reject)
- [ ] Open-queue still diffs; discard non-current-revision derivatives on approve
- [ ] Shared `moderation_events` history (paginated admin UI; no retained preview images)
- [ ] Tag names ALL CAPS on save
- [ ] Visibility public|unlisted|private
- [ ] Ownership / attribution fields (required Yes/No on create; label + source URL)
- [ ] Attribution claims (signed-in) + admin Claims queue + history
- [ ] Likes (UI)
- [ ] GLASS-backed storage via MediaStorage
- [ ] Favorites, collections, tag_aliases **tables** present



### Should have (after Must)

- [ ] Sticker packs + print layouts + PDF/PNG (`PrintLayout` / `encodePrint`) with cache
- [ ] Flutter editor shell consuming published Dart package
- [ ] GIF/video layers + timeline UI
- [ ] Keyframe animation on objects
- [ ] Filters beyond cutout; richer masks
- [ ] Server composer parity hardening / golden-image tests across platforms
- [ ] Favorites UI
- [ ] Collections UI
- [ ] Tag alias expansion in search
- [ ] **Meilisearch** search (replace/augment PG FTS)
- [ ] Related stickers
- [ ] Richer download stats / share tracking
- [ ] Presigned / path-token media URLs where private
- [ ] Additional print page sizes beyond initial seed layouts
- [ ] Collections / packs / layouts moderation via shared `moderation_events`



### Won’t (this version)

- [ ] Elasticsearch/OpenSearch
- [ ] AI recommendations
- [ ] Comments / social graph / chat / realtime notifications
- [ ] Event-level analytics warehouse
- [ ] Replace-upload of original binaries
- [ ] Commercial editor SDKs as document SoT (Polotno, CE.SDK, tldraw, …)
- [ ] Live parent composition layers in remix
- [ ] Non-Zitadel auth (Credentials, social IdPs, magic link, local passwords)

---



## 20. Platform assumptions

- App: Next.js (App Router), Node.js runtime for Route Handlers that talk to GLASS / Postgres
- Composition: portable core (TS → npm; Dart → Flutter) + web viewport (e.g. react-konva) + worker render; Flutter client **Should**
- DB: PostgreSQL via `DATABASE_URL` (Prisma migrate or equivalent); enable `pg_trgm` extension
- Queue: Redis + worker processes for composition render / cutout / media / print jobs; workers must run in deployment (not serverless-only for FFmpeg/ImageMagick)
- Auth env: Zitadel domain + client id/secret (sole Auth.js provider); service-account PAT + org id + project id for Management API; Auth.js `SESSION_SECRET`; callback URL aligned with `AUTH_URL`
- Session store: Auth.js JWT by default (no app `sessions` table; see DBML). Database adapter only if JWT proves insufficient
- GLASS base URL + service API key via env (not committed secrets). **Public PRISM UUID is not env** — BLOB creates it and stores it in `public_prism`. Per-user private prism UUIDs live on `users`.
- App origin (`AUTH_URL` / public site URL) and CORS on GLASS (if browser hits GLASS directly) must allow the BLOB origin; prefer proxying or signed URLs through the app when uncertain
- Deployment: web (Next.js) + at least one media/print worker; do not rely on Next.js alone for CPU-heavy processing

---



## 21. Domain sketch

```
USER (role, account_status, glass_private_prism_id)
  ├── ASSETS (immutable originals → GLASS)
  ├── STICKERS (created_by / uploaded_by)
  │      ├── COMPOSITION
  │      │      ├── COMPOSITION_REVISIONS (document_json)
  │      │      └── COMPOSITION_PARENTS → parent compositions (remix provenance)
  │      ├── MEDIA_ASSETS → GLASS (derivatives: image/chat/thumbnail/mask/gif/video)
  │      ├── TAGS (+ aliases)
  │      ├── CATEGORY
  │      ├── LIKES / FAVORITES
  │      └── COLLECTIONS
  └── PACKS
         ├── PACK_STICKERS → STICKERS
         └── GENERATED_PRINTS (layout + GLASS cache)

PUBLIC_PRISM (singleton) → GLASS public PRISM UUID
```

Schema detail: `[blob-schema.dbml](blob-schema.dbml)`.

---

*End of locked v1 requirements. Changes require an explicit revision of this document and, if needed, the DBML.*
