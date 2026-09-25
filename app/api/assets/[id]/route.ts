import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate, canUpload } from "@/lib/capabilities";
import { getGlass } from "@/lib/glass";
import { prisma } from "@/lib/prisma";
import { canAccessSticker } from "@/lib/stickers";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

/** Download immutable original bytes for the composition editor (remix/compose). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUpload({ role: user.role, accountStatus: user.accountStatus })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const asset = await prisma.asset.findUnique({ where: { id: BigInt(id) } });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });

  let allowed = isAdmin || asset.uploadedById === user.id;

  if (!allowed) {
    // Stickers whose current revision document references this asset_id.
    // ponytail: text LIKE on jsonb; typed walk if false positives become an issue
    const rows = await prisma.$queryRaw<{ sticker_id: bigint }[]>`
      SELECT s.id AS sticker_id
      FROM stickers s
      JOIN compositions c ON c.sticker_id = s.id
      JOIN composition_revisions cr ON cr.id = c.current_revision_id
      WHERE cr.document_json::text LIKE ${"%" + `"asset_id":"${id}"` + "%"}
         OR cr.document_json::text LIKE ${"%" + `"mask_asset_id":"${id}"` + "%"}
      LIMIT 20
    `;

    if (rows.length > 0) {
      const stickers = await prisma.sticker.findMany({
        where: { id: { in: rows.map((r) => r.sticker_id) } },
      });
      allowed = stickers.some((s) =>
        canAccessSticker(s, { viewerId: user.id, isAdmin: false }),
      );
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const glass = getGlass();
    const res = await glass.objects.download(asset.glassObjectId);
    const buf = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buf, {
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("Asset download failed:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 502 });
  }
}
