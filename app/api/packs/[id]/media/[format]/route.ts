import { NextResponse } from "next/server";
import { getGlass, glassPublicObjectUrl } from "@/lib/glass";
import { parsePrintFormat, PRINT_FORMAT, PRINT_STATUS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/session-user";

type Ctx = { params: Promise<{ id: string; format: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id, format: formatRaw } = await ctx.params;
  const format = parsePrintFormat(formatRaw);
  if (!format) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  let packId: bigint;
  try {
    packId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const pack = await prisma.stickerPack.findUnique({
    where: { id: packId },
  });
  if (!pack) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (pack.status !== PRINT_STATUS.ready) {
    const user = await sessionUser();
    if (user?.id !== pack.createdById) {
      return NextResponse.json({ error: "Not ready" }, { status: 404 });
    }
    return NextResponse.json({ error: "Not ready" }, { status: 409 });
  }

  const objectId =
    format === PRINT_FORMAT.pdf
      ? pack.pdfGlassObjectId
      : pack.pngGlassObjectId;
  if (!objectId) {
    return NextResponse.json({ error: "No media" }, { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("direct") === "1") {
    return NextResponse.redirect(glassPublicObjectUrl(objectId));
  }

  const glass = getGlass();
  const res = await glass.objects.download(objectId);
  const bytes = Buffer.from(await res.arrayBuffer());
  const mime =
    format === PRINT_FORMAT.pdf ? "application/pdf" : "image/png";
  const ext = format === PRINT_FORMAT.pdf ? "pdf" : "png";

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename="${pack.slug}.${ext}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
