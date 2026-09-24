import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { GlassError } from "glass-ts";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import { getGlass } from "@/lib/glass";
import {
  MODERATION_ACTION,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
  if (
    !admin ||
    !canModerate({ role: admin.role, accountStatus: admin.accountStatus })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sticker = await prisma.sticker.findUnique({
    where: { id: BigInt(id) },
    include: { media: true },
  });
  if (!sticker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // History first so purge is auditable even if GLASS/DB steps fail mid-flight.
  await recordModerationEvent({
    subjectType: MODERATION_SUBJECT.sticker,
    subjectId: sticker.id,
    subjectTitle: sticker.title,
    action: MODERATION_ACTION.rejected,
    actorId: admin.id,
  });

  // GIF/video stub may point several kinds at the same object_id.
  const objects = new Map<string, string>();
  for (const asset of sticker.media) {
    objects.set(asset.glassObjectId, asset.glassPrismId);
  }

  try {
    const glass = getGlass();
    for (const [objectId, prismId] of objects) {
      try {
        await glass.prisms.unlinkObject(prismId, objectId);
      } catch {
        // ponytail: unlink best-effort before delete
      }
      try {
        await glass.objects.delete(objectId);
      } catch (err) {
        // Already gone (prior partial reject, or shared id deleted earlier) — fine.
        if (err instanceof GlassError && err.status === 404) continue;
        throw err;
      }
    }
  } catch (err) {
    console.error("Reject GLASS purge failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "GLASS delete failed" },
      { status: 502 },
    );
  }

  await prisma.sticker.delete({ where: { id: sticker.id } });

  return NextResponse.json({ ok: true, status: "rejected" });
}
