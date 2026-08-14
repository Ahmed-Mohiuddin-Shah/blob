# BLOB Sticker Library — Locked v1 Requirements

**Status:** Locked  
**Scope:** Product and engineering requirements for BLOB v1  
**Companion schema:** [`docs/blob-schema.dbml`](blob-schema.dbml)  
**Storage contracts:** GLASS [`upload_download_api.md`](/home/server/dev-drive/glass/doc/upload_download_api.md), [`prisms_api.md`](/home/server/dev-drive/glass/doc/prisms_api.md)

This document freezes v1. Implement against this file and the DBML. Do not reopen decisions listed under **Locked decisions** without an explicit requirements revision.

---

## 1. Product summary

BLOB is a **public sticker library and sticker creation/browsing website** with two major areas:

1. **Library** — browse, search, filter, view, download/share stickers; members contribute uploads; admins moderate.
2. **Prints** — premade sticker packs and printable layouts; users select pack + layout and download a generated sheet (PDF/PNG).

**Stack (v1):**

- Frontend: Laravel Blade (+ Vite/Tailwind as already in the app)
- Metadata DB: PostgreSQL
- Object storage: GLASS (via a `MediaStorage` abstraction)
- Jobs: Laravel queue workers for media processing and print generation
- Search: PostgreSQL full-text search + `pg_trgm` (no Elasticsearch)

Search must find what the user typed (title, aliases, tags, categories, keywords)—not unrelated results.

---

## 2. Locked decisions

| Decision | Lock |
|----------|------|
| Auth | `role` + `account_status`, not `is_admin` / `is_member` booleans |
| Sticker media | `stickers` → many `media_assets`; never `image_path` / `gif_path` / `video_path` columns |
| Media mutation | Fit/crop/pad and binary media are set **only at create/upload**. After create, media assets are **immutable**. Metadata remains editable. |
| Primary category | One `category_id` per sticker + many tags |
| Tags | First-class `tags` table + pivot; not a comma string on the sticker row |
| Storage | Postgres = metadata + GLASS UUIDs; binaries only in GLASS |
| Search v1 | PostgreSQL FTS + `pg_trgm` |
| Prints | Separate domain: packs, layouts, generated_prints; generate on demand + cache |
| Video audio | Optional: preserve when present; not required; do not strip by default |
| Email verification | Deferred (column reserved; no v1 flow required) |
| Favorites / collections / tag aliases | Tables in schema; UI deferred to Should-have unless noted |

---

## 3. Out of scope (v1 won’t build)

- Elasticsearch / OpenSearch
- Recommendation / AI search
- Comments, following users, chat
- Real-time notifications
- Per-event analytics (who viewed what at which millisecond)
- Post-create media replace or in-browser canvas re-edit
- SVG print output (PDF + PNG only)
- Hardcoding every pack×layout file permanently upfront

---

## 4. Actors and authorization

### 4.1 User role

| Value | Meaning |
|-------|---------|
| `user` | Registered spectator (default after register) |
| `member` | Approved contributor; may upload |
| `admin` | Full management |

### 4.2 Account status

| Value | Meaning |
|-------|---------|
| `pending` | Awaiting activation / member approval gate |
| `active` | May use role capabilities |
| `suspended` | Temporarily blocked from privileged actions |
| `banned` | Permanently blocked |

**Upload and management require** `account_status = active` **and** an appropriate `role`. Suspended/banned users must not upload or manage content even if role remains `member`/`admin` until status is restored.

### 4.3 Capability matrix

| Capability | Anonymous | Registered (`user`) | Member | Admin |
|------------|:---------:|:-------------------:|:------:|:-----:|
| Browse / search public | Yes | Yes | Yes | Yes |
| Like | No | Yes* | Yes* | Yes* |
| Download | Yes† | Yes† | Yes† | Yes† |
| Upload stickers | No | No | Yes | Yes |
| Edit own sticker metadata | No | No | Yes | Yes |
| Manage own uploads (metadata, soft-hide request) | No | No | Yes | Yes |
| Approve members | No | No | No | Yes |
| Moderate any sticker | No | No | No | Yes |
| Manage packs / layouts | No | No | No | Yes |

\* Requires `account_status = active`.  
† Subject to sticker visibility and download policy; unlisted requires knowing the link; private only for authorized users.

**Registration defaults (locked):** `role = user`, `account_status = active`. New accounts are registered spectators (browse, search, like, download). Upload requires an admin to set `role = member` (or `admin`). `account_status` of `suspended` or `banned` blocks likes, uploads, and management regardless of role. Use `pending` only when an admin deliberately gates an account before activation.

---

## 5. Authentication and profiles

### Must have

- Registration (email, password, username, display name)
- Login / logout
- Password reset
- Profile: username, display name, avatar
- Admin: change `role`, change `account_status`, approve members

### Deferred

- Email verification UI/flow (keep `email_verified_at` nullable)

### Avatar

Avatar image uploads go **application server → GLASS**. Postgres stores `avatar_glass_object_id` (+ prism id). Do not store avatar binaries in Postgres or only on local disk for production.

Use boring Laravel session auth (e.g. Breeze or equivalent). No exotic auth for v1.

---

## 6. Sticker model

A **sticker** is the primary content object. Required metadata fields:

- Title, description, slug
- `created_by`, `uploaded_by` (may differ)
- Primary `category_id` (nullable until set; admins/members should set before approve)
- Tags (many)
- Alternate names / keywords (for search)
- Attribution: author_name, attribution, source_url, license, copyright_status
- `visibility`: `public` | `unlisted` | `private`
- `moderation_status`: `draft` | `pending_review` | `approved` | `rejected` | `hidden` | `deleted`
- `processing_status`: `processing` | `ready` | `failed`
- `fit_mode` + `pad_background` (immutable after create)
- Aggregate counters: views, downloads, likes, shares, search_appearances

### Content representations

Logical sticker with multiple **media assets**, not three hardcoded columns:

```
Sticker
  ├── original
  ├── image   (static square rendition when applicable)
  ├── gif     (when source/animation warrants)
  ├── video   (≤10s square mp4 when applicable)
  └── thumbnail
```

Which derived kinds are produced depends on the uploaded original (static image → image+thumbnail; GIF → optimized gif + web-friendly preview asset kind as needed + thumbnail; video → video + thumbnail). Schema allows kinds via `media_assets.kind`; v1 kinds are exactly: `original`, `image`, `gif`, `video`, `thumbnail`.

---

## 7. Create / upload lifecycle (media locked here)

### 7.1 Flow

```
Member uploads file + metadata + fit_mode
        ↓
Validate MIME, magic bytes, size, dimensions, duration, frames
        ↓
Store original in GLASS (private prism while pending)
        ↓
Create sticker row (processing_status=processing, moderation_status=pending_review)
        ↓
Enqueue processing job
        ↓
Worker: square renditions (crop|fit|pad), strip EXIF on public outputs,
        generate thumbnail / gif / video as required
        ↓
Upload derived assets to GLASS; write media_assets rows
        ↓
processing_status = ready | failed
        ↓
Admin reviews → approved | rejected | …
        ↓
On approve + public: ensure public-readable assets linked to public PRISM
```

Upload **must not** block the HTTP request on FFmpeg/ImageMagick. Show “Processing…” in the UI while `processing_status = processing`.

### 7.2 Square standardization

All display renditions target a **1:1 square** canvas. **Do not** blindly crop without user choice at create time.

`fit_mode` (set once at create):

| Mode | Behavior |
|------|----------|
| `crop` | Center-crop (or documented crop policy) to square |
| `fit` | Scale to fit inside square; pad remainder |
| `pad` | Scale to fit; pad with `pad_background` (`transparent` or `#RRGGBB`) |

### 7.3 Edit rules (locked)

| What | When editable |
|------|----------------|
| Original file / derived binaries | **Create/upload only** — immutable afterward |
| `fit_mode`, `pad_background` | **Create only** |
| Title, description, tags, category, visibility, attribution, keywords | After create: owner (member) for own stickers; admin for any — subject to moderation rules |
| Replacing media | **Out of scope** — delete/reject and re-upload as a new sticker if needed |

Metadata edits: website → Laravel → PostgreSQL.  
Any **new** binary (create upload, avatar): website → Laravel → GLASS → store object UUID in Postgres.

---

## 8. Media rules

### 8.1 Video

- Max duration: **10 seconds**
- Audio: optional; **preserve when present**
- Square output; standardized codec/container (**mp4**)
- Always generate `thumbnail` (e.g. webp/jpeg) for cards
- Enforce file size and resolution caps (configure in app; document in env)

### 8.2 GIF

- Enforce max dimensions, frame count, file size, processing timeout, output size
- Prefer lightweight preview for browse grids (thumbnail / optimized asset); retain downloadable GIF asset when that is the deliverable
- Do not load dozens of full-size animated GIFs on a browse page without thumbnails

### 8.3 Trust and safety for files

- Validate declared MIME **and** file signatures
- Enforce size / resolution / duration / frame / timeout / worker memory / queue concurrency limits
- Strip unnecessary EXIF/metadata from **generated public** assets
- Process in isolated queue workers, not the web PHP process

### 8.4 Original retention

Keep the **original** in GLASS whenever legally/technically appropriate so processing settings can be revisited in a future version without re-upload. v1 still does **not** expose post-create reprocess UI.

---

## 9. Moderation

Uploads are **not** immediately public library content.

```
Member uploads → pending_review → Admin → approved | rejected
```

Admins can: approve, reject, hide, delete (soft via `moderation_status = deleted`), edit metadata, change tags/category, change ownership (`created_by` / `uploaded_by`).

Public browse/search includes only stickers that are:

- `moderation_status = approved`
- `processing_status = ready`
- `visibility = public`

Unlisted: reachable by direct link when approved+ready; excluded from search/browse listings.  
Private: only owner and admins.

---

## 10. Search

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

---

## 11. Tags and categories

**Categories** — controlled hierarchy (admin-managed): e.g. Memes, Reactions, Animals, People, Gaming, Anime, Movies, Internet, Miscellaneous.

**Tags** — free-form descriptive labels; own table; sticker↔tag pivot.

Do not store tags as `"cat, angry, funny"` on the sticker row.

---

## 12. Likes, favorites, collections

| Feature | Semantics | v1 |
|---------|-----------|-----|
| Like | “I like this” | **Must** — UI + `sticker_likes` + `likes_count` |
| Favorite | “Save to find again” | Schema **Must**; UI **Should** |
| Collections | User lists of stickers | Schema **Must**; UI **Should** |

Likes and favorites are distinct tables.

---

## 13. Prints domain

Treat as separate from the core sticker row:

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

## 14. Storage architecture (GLASS)

```
PostgreSQL          GLASS
─────────────       ─────────────────────────
users, stickers     objects (bytes)
media_assets  ──►   glass_object_id + glass_prism_id
packs/prints  ──►   same
```

### MediaStorage abstraction

Application code shall depend on a **MediaStorage** interface (upload, download URL, delete/unlink), not raw GLASS HTTP scattered through controllers. GLASS is the production implementation; local/dev may use a filesystem stub behind the same interface.

### PRISM strategy (v1 lock)

| Content | PRISM |
|---------|--------|
| Approved **public** derived assets (and public downloads) | Public PRISM — anonymous `GET` / `HEAD` |
| Originals, pending/rejected, **private** / **unlisted** assets | Private PRISM — service key or signed object/PRISM JWT |
| Generated prints | Private or public per product need; default **private** with signed download for the requester, or public if the pack is public — **lock:** use private PRISM + short-lived download JWT/path token for downloads unless pack is public, in which case public PRISM is allowed |

Persist on every stored object reference: `glass_object_id`, `glass_prism_id`, and checksum when provided by GLASS.

Uploads use GLASS `PUT` (simple or multipart) with `prism_id` and SHA-256 checksum per GLASS contract. Never trust client-supplied object IDs without server-side upload.

---

## 15. Statistics

v1: **aggregate counters only** on `stickers` (and pack-level later if needed). No eternal per-view event log.

Increment on meaningful actions (view detail, download, like, share, search impression) with reasonable debouncing left to implementation—but do not build a full analytics warehouse.

---

## 16. API surface

Even with Blade first, backends should stay service-clean. Intended HTTP API (JSON) for v1:

```
GET    /api/stickers
GET    /api/stickers/{id}
GET    /api/search
GET    /api/tags
GET    /api/categories

POST   /api/stickers
PATCH  /api/stickers/{id}          # metadata only — no media body
DELETE /api/stickers/{id}          # soft delete / hide per policy

POST   /api/stickers/{id}/like
DELETE /api/stickers/{id}/like

GET    /api/packs
GET    /api/packs/{id}

GET    /api/prints/layouts
POST   /api/prints/generate
```

Blade may call domain services directly; the above is the contract boundary for any SPA/API client later. `PATCH` must reject media file replacement.

---

## 17. Hard rules (pitfalls → requirements)

1. Retain originals in GLASS; do not keep only processed derivatives.
2. Use `media_assets`; never three hardcoded media path columns on `stickers`.
3. Tags are entities + pivots, not CSV strings.
4. Search must include aliases/keywords path; ship FTS+trgm first; alias table ready.
5. Never trust uploads: MIME + magic bytes + limits + worker isolation.
6. Strip EXIF from generated public assets.
7. Cap GIF/video CPU/RAM/time; set queue concurrency deliberately.
8. Ownership is explicit (`created_by` / `uploaded_by` + attribution fields).
9. Couple to GLASS only through `MediaStorage`.
10. Print sheets: on-demand + cache; no combinatorial pre-generation.

---

## 18. v1 checklist

### Must have

- [ ] Users with `role` + `account_status`
- [ ] Registration, login/logout, password reset, profile (+ avatar via GLASS)
- [ ] Admin member promotion / status management
- [ ] Public browse + search (FTS + pg_trgm)
- [ ] Stickers with tags + primary category
- [ ] Media assets: original / image / gif / video / thumbnail
- [ ] Square renditions with crop|fit|pad at **create only**
- [ ] Video ≤10s; audio preserved when present
- [ ] Member upload + async processing + admin moderation
- [ ] Visibility public|unlisted|private
- [ ] Ownership / attribution fields
- [ ] Likes (UI)
- [ ] Sticker packs + print layouts + PDF/PNG generation with cache
- [ ] GLASS-backed storage via MediaStorage
- [ ] Favorites, collections, tag_aliases **tables** present

### Should have (after Must)

- [ ] Favorites UI
- [ ] Collections UI
- [ ] Tag alias expansion in search
- [ ] Related stickers
- [ ] Richer download stats / share tracking
- [ ] Presigned / path-token media URLs where private
- [ ] Additional print page sizes beyond initial seed layouts

### Won’t (this version)

- [ ] Elasticsearch/OpenSearch
- [ ] AI recommendations
- [ ] Comments / social graph / chat / realtime notifications
- [ ] Event-level analytics warehouse
- [ ] Post-create media editing or replace-upload

---

## 19. Platform assumptions

- App: Laravel (current repo), PostgreSQL (`DB_CONNECTION=pgsql`)
- Queue: database driver acceptable for v1; workers must run in deployment
- Align Laravel env keys with framework expectations (`DB_DATABASE` / `DB_USERNAME`, not nonstandard aliases) before running migrations
- GLASS base URL, service API key, public/private PRISM UUIDs configured via env (not committed secrets)
- `APP_URL` and CORS on GLASS (if browser hits GLASS directly) must allow the BLOB origin; prefer proxying or signed URLs through the app when uncertain

---

## 20. Domain sketch

```
USER (role, account_status)
  ├── STICKERS (created_by / uploaded_by)
  │      ├── MEDIA_ASSETS → GLASS
  │      ├── TAGS (+ aliases)
  │      ├── CATEGORY
  │      ├── LIKES / FAVORITES
  │      └── COLLECTIONS
  └── PACKS
         ├── PACK_STICKERS → STICKERS
         └── GENERATED_PRINTS (layout + GLASS cache)
```

Schema detail: [`blob-schema.dbml`](blob-schema.dbml).

---

*End of locked v1 requirements. Changes require an explicit revision of this document and, if needed, the DBML.*
