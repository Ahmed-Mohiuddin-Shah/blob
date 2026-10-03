import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import {
  getGlass,
  getPublicPrismId,
  glassPublicObjectUrl,
} from "@/lib/glass";
import { prisma } from "@/lib/prisma";
import {
  canAccessSticker,
  isPublicBrowseable,
  isStillImageMime,
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
} from "@/lib/stickers";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

const ALLOWED_KINDS = new Set<string>(Object.values(MEDIA_KIND));

const PUBLIC_CACHE =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
const PRIVATE_CACHE = "private, max-age=60";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; kind: string }> },
) {
  const { id, kind } = await context.params;
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const sticker = await prisma.sticker.findUnique({
    where: { id: BigInt(id) },
    include: {
      media: true,
      blobber: { select: { userId: true } },
    },
  });
  if (!sticker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await sessionUser();
  const isAdmin = !!(
    user &&
    canModerate({ role: user.role, accountStatus: user.accountStatus })
  );

  if (
    !canAccessSticker(
      { ...sticker, blobberUserId: sticker.blobber?.userId ?? null },
      {
        viewerId: user?.id ?? null,
        isAdmin,
      },
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ready = (m: (typeof sticker.media)[number]) =>
    m.status === MEDIA_ASSET_STATUS.ready;
  const readyStill = (m: (typeof sticker.media)[number]) =>
    ready(m) && isStillImageMime(m.mimeType);

  let asset = sticker.media.find((m) => m.kind === kind && ready(m));
  // Thumbnail: skip VIDEO-matrix mp4 slots; fall through stills for grids.
  if (kind === MEDIA_KIND.thumbnail) {
    if (asset && !isStillImageMime(asset.mimeType)) asset = undefined;
    if (!asset) {
      for (const fallback of [
        MEDIA_KIND.chat,
        MEDIA_KIND.image,
        MEDIA_KIND.gif,
        MEDIA_KIND.og,
        MEDIA_KIND.prevThumbnail,
      ] as const) {
        asset = sticker.media.find((m) => m.kind === fallback && readyStill(m));
        if (asset) break;
      }
    }
  }
  if (
    !asset &&
    (kind === MEDIA_KIND.image || kind === MEDIA_KIND.chat)
  ) {
    asset = sticker.media.find(
      (m) => m.kind === MEDIA_KIND.thumbnail && readyStill(m),
    );
  }
  if (!asset) {
    return NextResponse.json({ error: "No media" }, { status: 404 });
  }

  const isPublic = isPublicBrowseable(sticker);

  // Public PRISM objects are anonymously readable at /objects/:id — redirect.
  // If media is still on a private PRISM (post-approve re-encode/OG gap), proxy.
  if (isPublic && asset.glassObjectId) {
    try {
      const publicPrismId = await getPublicPrismId();
      if (asset.glassPrismId === publicPrismId) {
        const res = NextResponse.redirect(
          glassPublicObjectUrl(asset.glassObjectId),
          302,
        );
        res.headers.set("Cache-Control", PUBLIC_CACHE);
        return res;
      }
    } catch {
      /* fall through to authenticated download */
    }
  }

  try {
    const glass = getGlass();
    const res = await glass.objects.download(asset.glassObjectId);
    const buf = Buffer.from(await res.arrayBuffer());
    // Prefer DB mime — Glass may guess Content-Type from object title.
    const contentType = asset.mimeType || "application/octet-stream";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": isPublic ? PUBLIC_CACHE : PRIVATE_CACHE,
      },
    });
  } catch (err) {
    console.error("Media download failed:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 502 });
  }
}
