import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import {
  MODERATION_ACTION,
  MODERATION_SUBJECT,
  recordModerationEvent,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
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

  let body: { note?: string };
  try {
    body = (await request.json()) as { note?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const note = (body.note ?? "").trim();
  if (!note) {
    return NextResponse.json({ error: "Note is required" }, { status: 400 });
  }

  const sticker = await prisma.sticker.findUnique({
    where: { id: BigInt(id) },
  });
  if (!sticker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (sticker.moderationStatus === "rejected") {
    return NextResponse.json({ error: "Sticker already rejected" }, { status: 409 });
  }

  await prisma.sticker.update({
    where: { id: sticker.id },
    data: {
      moderationStatus: "needs_edit",
      moderationNote: note.slice(0, 2000),
    },
  });

  await recordModerationEvent({
    subjectType: MODERATION_SUBJECT.sticker,
    subjectId: sticker.id,
    subjectTitle: sticker.title,
    action: MODERATION_ACTION.editRequested,
    actorId: admin.id,
    note,
  });

  return NextResponse.json({ ok: true, status: "needs_edit" });
}
