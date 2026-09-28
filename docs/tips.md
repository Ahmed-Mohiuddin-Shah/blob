# Tips

## Glass / glass-ts — better media loads

BLOB already mitigates what it can app-side: public sticker thumbs **302** to Glass, card grids use **still thumbnails** (not GIF), and media routes send longer `Cache-Control`. Further wins need Glass (and optionally a CDN in front of public PRISM objects).

### Conditional requests ([304 Not Modified](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/304))

On `GET` / `HEAD` `/objects/{id}`:

- Emit a stable **`ETag`** (content hash or object version) and **`Last-Modified`**.
- Honor **`If-None-Match`** / **`If-Modified-Since`** and respond with **304** (no body) when the client cache is still valid.

Browsers and CDNs can then revalidate without re-downloading bytes. BLOB’s redirects to `glassPublicObjectUrl` benefit automatically once Glass supports this.

### CDN + cache headers

For anonymous public-PRISM object GETs:

- Long **`Cache-Control`** / **`s-maxage`** with **`stale-while-revalidate`** at the edge.
- Prefer **`immutable`** (or very long max-age) when object IDs are content-addressed / never overwritten.

### Nice-to-have (not required for 304)

- `Accept` / format negotiation or query transforms (`webp` / `avif`, width) so grids don’t need a derivative per display size.

### References

- Glass API docs in the glass repo (`upload_download_api.md`, `prisms_api.md`).
- BLOB media entry: `app/api/stickers/[id]/media/[kind]/route.ts`, `lib/glass.ts` (`glassPublicObjectUrl`).
