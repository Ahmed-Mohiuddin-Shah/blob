import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { enqueueCompositionEncode } from "@/lib/composition-encode";
import { PROCESSING_STATUS } from "@/lib/stickers";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

/** Owner or admin: regenerate derivatives from current composition revision + assets. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const sticker = await prisma.sticker.findUnique({
    where: { id: BigInt(id) },
    include: { composition: true },
  });
  if (!sticker?.composition) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  const isOwner =
    sticker.createdById === user.id || sticker.uploadedById === user.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.sticker.update({
    where: { id: sticker.id },
    data: { processingStatus: PROCESSING_STATUS.processing, processingError: null },
  });
  enqueueCompositionEncode(sticker.id);

  return NextResponse.json({ ok: true });
}
