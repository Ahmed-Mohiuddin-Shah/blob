# BLOB Sticker Library — Locked v1 Requirements

**Status:** Locked  
**Scope:** Product and engineering requirements for BLOB v1  
**Companion schema:** `[docs/blob-schema.dbml](blob-schema.dbml)`  
**Storage contracts:** GLASS `[upload_download_api.md](/home/server/dev-drive/glass/doc/upload_download_api.md)`, `[prisms_api.md](/home/server/dev-drive/glass/doc/prisms_api.md)`

This document freezes v1. Implement against this file and the DBML. Do not reopen decisions listed under **Locked decisions** without an explicit requirements revision.

---

## 1. Product summary

BLOB is a **public sticker library and sticker creation/browsing website** with two major areas:

1. **Library** — browse, search, filter, view, download/share stickers; members contribute uploads; admins moderate.
2. **Prints** — premade sticker packs and printable layouts; users select pack + layout and download a generated sheet (PDF/PNG).

**Stack (v1):**

- App: **Next.js** (App Router) — React Server Components for browse/detail; Client Components only where interactivity needs them (upload, like, fit-mode picker, admin actions)
- Styling: Tailwind CSS
- Metadata DB: PostgreSQL (access via Prisma or equivalent typed client)
- Object storage: GLASS (via a gitsubmodule or custom npm package)
- Jobs: separate Node workers (e.g. BullMQ / Redis, or equivalent) for media processing and print generation — **not** inside the Next.js request lifecycle
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
| Sticker media                         | `stickers` → many `media_assets`; never `image_path` / `gif_path` / `video_path` columns                                                      |
| Media mutation                        | Fit/crop/pad and binary media are set **only at create/upload**. After create, media assets are **immutable**. Metadata remains editable.     |
| Primary category                      | One `category_id` per sticker + many tags                                                                                                     |
| Tags                                  | First-class `tags` table + pivot; not a comma string on the sticker row                                                                       |
| Storage                               | Postgres = metadata + GLASS UUIDs; binaries only in GLASS                                                                                     |
| Search v1                             | PostgreSQL FTS + `pg_trgm` (Meilisearch planned post-v1)                                                                                      |
| Prints                                | Separate domain: packs, layouts, generated_prints; generate on demand + cache                                                                 |
| Video audio                           | Optional: preserve when present; not required; do not strip by default                                                                        |
| Email verification                    | Deferred (column reserved; no v1 flow required)                                                                                               |
| Favorites / collections / tag aliases | Tables in schema; UI deferred to Should-have unless noted                                                                                     |
| Tag display names                     | Stored **ALL CAPS** on save (`ANGRY CAT`); slug remains lowercase                                                                             |
| Moderation history                    | Shared polymorphic `moderation_events` (stickers now; collections / packs / layouts later)                                                    |


---



## 3. Out of scope (v1 won’t build)

- Elasticsearch / OpenSearch (Meilisearch is the planned post-v1 search engine)
- Recommendation / AI search
- Comments, following users, chat
- Real-time notifications
- Per-event analytics (who viewed what at which millisecond)
- Post-create media replace or in-browser canvas re-edit
- SVG print output (PDF + PNG only)
- Hardcoding every pack×layout file permanently upfront
- Any auth besides Zitadel (Credentials, social IdPs, magic links, API keys for end-user login, local password/register)

---



## 4. Actors and authorization



### 4.1 User role


| Value    | Meaning                                       |
| -------- | --------------------------------------------- |
| `user`   | Registered spectator (default after register) |
| `member` | Approved contributor; may upload              |
| `admin`  | Full management                               |




### 4.2 Account status


| Value       | Meaning                                     |
| ----------- | ------------------------------------------- |
| `pending`   | Awaiting activation / member approval gate  |
| `active`    | May use role capabilities                   |
| `suspended` | Temporarily blocked from privileged actions |
| `banned`    | Permanently blocked                         |


**Upload and management require** `account_status = active` **and** an appropriate `role`. Suspended/banned users must not upload or manage content even if role remains `member`/`admin` until status is restored.

### 4.3 Capability matrix


| Capability                                       | Anonymous | Registered (`user`) | Member | Admin |
| ------------------------------------------------ | --------- | ------------------- | ------ | ----- |
| Browse / search public                           | Yes       | Yes                 | Yes    | Yes   |
| Like                                             | No        | Yes*                | Yes*   | Yes*  |
| Download                                         | Yes†      | Yes†                | Yes†   | Yes†  |
| Upload stickers                                  | No        | No                  | Yes    | Yes   |
| Edit own sticker metadata                        | No        | No                  | Yes    | Yes   |
| Manage own uploads (metadata, soft-hide request) | No        | No                  | Yes    | Yes   |
| Approve members                                  | No        | No                  | No     | Yes   |
| Moderate any sticker                             | No        | No                  | No     | Yes   |
| Manage packs / layouts                           | No        | No                  | No     | Yes   |


 Requires `account_status = active`.  
† Subject to sticker visibility and download policy; unlisted requires knowing the link; private only for authorized users.

**Registration defaults (locked):** `role = user` (Zitadel grant + local mirror), `account_status = active`. New accounts are registered spectators (browse, search, like, download). Upload requires an admin to grant Zitadel `member` (or `admin`) via BLOB admin UI. `account_status` of `suspended` or `banned` blocks likes, uploads, and management regardless of role. Use `pending` only when an admin deliberately gates an account before activation.

---



## 5. Authentication and profiles



### Must have

- Login / logout via **Zitadel only** (OIDC + PKCE through Auth.js). Auth.js must register a single Zitadel provider — no Credentials, Google, GitHub, Apple, magic-link, or other providers
- No local password hash, no email/password register or login UI, no multi-account linking
- First login upserts local `users` by `zitadel_id` (OIDC `sub`); defaults `role=user`, `account_status=active`
- **Roles:** Zitadel project roles (`user`  `member`  `admin`) are source of truth. BLOB mirrors into `users.role` from OIDC claims on login. Fine-grained capabilities stay in app code (capability matrix)
- **Role / profile writes:** BLOB drives Zitadel via Management API using a service-account PAT (`ZITADEL_SERVICE_PAT` + org/project ids). Admins assign roles in-app; users edit display name / email in-app. No parallel role store for writes
- Profile fields synced from Zitadel claims on login: display name, email, `email_verified_at` (never sync or display Zitadel `picture`). Users may also edit display name / email / local `username` from the BLOB profile UI
- Local `username` set on first create (URL-safe handle); editable in BLOB only (blobatar)
- Admin: change `role` (via Zitadel user grant), change `account_status` (app DB only)
- Protect routes with Next.js middleware / server-side session checks; expose role + account_status on the session for capability gates



### Deferred

- Email verification UI/flow (keep `email_verified_at` nullable; populated from Zitadel claim)



### Avatar

User faces are **[blobatar](https://blobatar.dev/)** generated from `username` only. Do **not** store or display Zitadel `picture` / profile images (no `avatar_url` column). Sticker/media binaries still go application server → GLASS.

Auth.js establishes the app session after the Zitadel OIDC callback. Zitadel is the identity and role source; `users.role` is a local mirror for gates and queries.

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
- `moderation_status`: `draft` | `pending_review` | `needs_edit` | `approved` | `rejected` | `hidden` | `deleted`
- `moderation_note`: current open edit-request reason (cleared on resubmit)
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
Admin reviews → approved | needs_edit | reject (purge) | …
        ↓
On approve + public: link assets to the app-owned public PRISM (`public_prism` row; create via Glass on first use if missing)
```

Upload **must not** block the HTTP request on FFmpeg/ImageMagick. Show “Processing…” in the UI while `processing_status = processing`.

### 7.2 Square standardization

All display renditions target a **1:1 square** canvas. **Do not** blindly crop without user choice at create time.

`fit_mode` (set once at create):


| Mode   | Behavior                                                             |
| ------ | -------------------------------------------------------------------- |
| `crop` | Center-crop (or documented crop policy) to square                    |
| `fit`  | Scale to fit inside square; pad remainder                            |
| `pad`  | Scale to fit; pad with `pad_background` (`transparent` or `#RRGGBB`) |




### 7.3 Edit rules (locked)


| What                                                                  | When editable                                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Original file / derived binaries                                      | **Create/upload only** — immutable afterward                                               |
| `fit_mode`, `pad_background`                                          | **Create only**                                                                            |
| Title, description, tags, category, visibility, attribution, keywords | After create: owner (member) for own stickers; admin for any — subject to moderation rules |
| Replacing media                                                       | **Out of scope** — delete/reject and re-upload as a new sticker if needed                  |


Metadata edits: browser → Next.js Route Handler / Server Action → PostgreSQL.  
Any **new** sticker binary (create upload): browser → Next.js Route Handler → GLASS → store object UUID in Postgres → enqueue worker job. User faces use blobatar(`username`), not GLASS or Zitadel pictures.

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
- Process in isolated queue workers, not the Next.js Node process that serves HTTP



### 8.4 Original retention

Keep the **original** in GLASS whenever legally/technically appropriate so processing settings can be revisited in a future version without re-upload. v1 still does **not** expose post-create reprocess UI.

---



## 9. Moderation

Uploads are **not** immediately public library content.

```
Member uploads → pending_review → Admin → approved | needs_edit | reject (purge)
needs_edit → owner or admin edits metadata → pending_review
```

Admins can: approve, **request edit** (required note/reason), reject (hard purge), hide, soft-delete (`moderation_status = deleted`), edit metadata, change tags/category, change ownership (`created_by` / `uploaded_by`).

**Reject (locked):** delete all sticker media objects from GLASS, then delete the local sticker row (cascades media + tag pivots). Record a `rejected` row in `moderation_events` before purge so history survives. Soft `rejected` status is not retained for this action.

**Edit request:** set `moderation_status = needs_edit` and `moderation_note`. Owner or admin edits metadata (media immutable). On save from `needs_edit`, status returns to `pending_review` and note clears (`resubmitted` event).

**Shared history:** all moderation actions write to polymorphic `moderation_events` (`subject_type` + `subject_id`, no subject FK). Stickers use it now; collections, sticker packs, and print layouts reuse the same table and admin history UI when those domains gain moderation.

Public browse/search includes only stickers that are:

- `moderation_status = approved`
- `processing_status = ready`
- `visibility = public`

Unlisted: reachable by direct link when approved+ready; excluded from search/browse listings.  
Private: only owner after approve; admins may view only while pending review or needs edit (not after approve).

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



### Planned: Meilisearch (post-v1)

Meilisearch is the intended next search engine (replaces or augments PG FTS). Same field contract: title, aliases, tags, categories, keywords, author. Tag **display** names stay ALL CAPS in Postgres; search indexes treat them case-insensitively. Sync/index workers are out of scope for v1.

---



## 11. Tags and categories

**Categories** — controlled hierarchy (admin-managed): e.g. Memes, Reactions, Animals, People, Gaming, Anime, Movies, Internet, Miscellaneous.

**Tags** — free-form descriptive labels; own table; sticker↔tag pivot. On save, normalize display `name` to **ALL CAPS** (e.g. `angry cat` → `ANGRY CAT`); `slug` stays lowercase (`angry-cat`).

Do not store tags as a comma string on the sticker row.

---



## 12. Likes, favorites, collections


| Feature     | Semantics              | v1                                              |
| ----------- | ---------------------- | ----------------------------------------------- |
| Like        | “I like this”          | **Must** — UI + `sticker_likes` + `likes_count` |
| Favorite    | “Save to find again”   | Schema **Must**; UI **Should**                  |
| Collections | User lists of stickers | Schema **Must**; UI **Should**                  |


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
PostgreSQL                    GLASS
─────────────                 ─────────────────────────
users, stickers               objects (bytes)
media_assets  ──►             glass_object_id + glass_prism_id
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



## 15. Statistics

v1: **aggregate counters only** on `stickers` (and pack-level later if needed). No eternal per-view event log.

Increment on meaningful actions (view detail, download, like, share, search impression) with reasonable debouncing left to implementation—but do not build a full analytics warehouse.

---



## 16. API surface

Prefer **Server Components / Server Actions** for first-party UI reads and simple mutations. Expose the same domain through **Route Handlers** (`app/api/...`) as a JSON contract for uploads, likes, print generation, and any non-Next client. Keep domain logic in shared server modules — not duplicated in pages and handlers.

Intended HTTP API (JSON) for v1:

```
GET    /api/stickers
GET    /api/stickers/{id}
PATCH  /api/stickers/{id}          # metadata only — no media body
GET    /api/search
GET    /api/tags
GET    /api/categories

POST   /api/stickers
POST   /api/stickers/{id}/approve
POST   /api/stickers/{id}/reject          # purge GLASS objects then delete row
POST   /api/stickers/{id}/request-edit    # body: { note } required

GET    /api/moderation/events             # admin; cursor pagination; filters subjectType/action

POST   /api/stickers/{id}/like
DELETE /api/stickers/{id}/like

GET    /api/packs
GET    /api/packs/{id}

GET    /api/prints/layouts
POST   /api/prints/generate
```

`PATCH` must reject media file replacement. Large uploads and long-running work go through handlers that return quickly and enqueue workers.

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

- [ ] Users with `role` + `account_status` (role mirrored from Zitadel)
- [ ] Zitadel-only login/logout (no other Auth.js providers), local profile (`username` / `display_name`), blobatar avatars; profile edit via Management API
- [ ] Admin member promotion (Zitadel grant via PAT) / local status management
- [ ] Public browse + search (FTS + pg_trgm)
- [ ] Stickers with tags + primary category
- [ ] Media assets: original / image / gif / video / thumbnail
- [ ] Square renditions with crop|fit|pad at **create only**
- [ ] Video ≤10s; audio preserved when present
- [ ] Member upload + async processing + admin moderation (approve / request-edit / purge-reject)
- [ ] Shared `moderation_events` history (paginated admin UI)
- [ ] Tag names ALL CAPS on save
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
- [ ] Post-create media editing or replace-upload
- [ ] Non-Zitadel auth (Credentials, social IdPs, magic link, local passwords)

---



## 19. Platform assumptions

- App: Next.js (App Router), Node.js runtime for Route Handlers that talk to GLASS / Postgres
- DB: PostgreSQL via `DATABASE_URL` (Prisma migrate or equivalent); enable `pg_trgm` extension
- Queue: Redis + worker processes for media/print jobs; workers must run in deployment (not serverless-only for FFmpeg/ImageMagick)
- Auth env: Zitadel domain + client id/secret (sole Auth.js provider); service-account PAT + org id + project id for Management API; Auth.js `SESSION_SECRET`; callback URL aligned with `AUTH_URL`
- Session store: Auth.js JWT by default (no app `sessions` table; see DBML). Database adapter only if JWT proves insufficient
- GLASS base URL + service API key via env (not committed secrets). **Public PRISM UUID is not env** — BLOB creates it and stores it in `public_prism`. Per-user private prism UUIDs live on `users`.
- App origin (`AUTH_URL` / public site URL) and CORS on GLASS (if browser hits GLASS directly) must allow the BLOB origin; prefer proxying or signed URLs through the app when uncertain
- Deployment: web (Next.js) + at least one media/print worker; do not rely on Next.js alone for CPU-heavy processing

---



## 20. Domain sketch

```
USER (role, account_status, glass_private_prism_id)
  ├── STICKERS (created_by / uploaded_by)
  │      ├── MEDIA_ASSETS → GLASS
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