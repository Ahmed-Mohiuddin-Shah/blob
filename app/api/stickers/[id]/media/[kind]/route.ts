import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import { getGlass } from "@/lib/glass";
import { prisma } from "@/lib/prisma";
import { canAccessSticker, isPublicBrowseable, MEDIA_ASSET_STATUS, MEDIA_KIND } from "@/lib/stickers";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

const ALLOWED_KINDS = new Set<string>(Object.values(MEDIA_KIND));

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
    !canAccessSticker(sticker, {
      viewerId: user?.id ?? null,
      isAdmin,
    })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let asset = sticker.media.find(
    (m) => m.kind === kind && m.status === MEDIA_ASSET_STATUS.ready,
  );
  if (!asset && kind === MEDIA_KIND.thumbnail) {
    asset =
      sticker.media.find(
        (m) =>
          m.kind === MEDIA_KIND.image && m.status === MEDIA_ASSET_STATUS.ready,
      ) ??
      sticker.media.find(
        (m) =>
          m.kind === MEDIA_KIND.chat && m.status === MEDIA_ASSET_STATUS.ready,
      );
  }
  if (
    !asset &&
    (kind === MEDIA_KIND.image || kind === MEDIA_KIND.chat)
  ) {
    asset = sticker.media.find(
      (m) =>
        m.kind === MEDIA_KIND.thumbnail &&
        m.status === MEDIA_ASSET_STATUS.ready,
    );
  }
  if (!asset) {
    return NextResponse.json({ error: "No media" }, { status: 404 });
  }

  try {
    const glass = getGlass();
    const res = await glass.objects.download(asset.glassObjectId);
    const buf = Buffer.from(await res.arrayBuffer());
    // Prefer DB mime — Glass may guess Content-Type from object title.
    const contentType = asset.mimeType || "application/octet-stream";
    const cache = isPublicBrowseable(sticker)
      ? "public, max-age=300"
      : "private, max-age=60";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cache,
      },
    });
  } catch (err) {
    console.error("Media download failed:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 502 });
  }
}
