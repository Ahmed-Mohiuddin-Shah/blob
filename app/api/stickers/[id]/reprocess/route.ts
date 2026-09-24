import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { enqueueStickerProcessing } from "@/lib/sticker-process-stub";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

/** Admin: regenerate image/thumbnail from original (fixes bad sharp derivatives). */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canModerate({ role: user.role, accountStatus: user.accountStatus })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const sticker = await prisma.sticker.findUnique({ where: { id: BigInt(id) } });
  if (!sticker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.sticker.update({
    where: { id: sticker.id },
    data: { processingStatus: "processing", processingError: null },
  });
  enqueueStickerProcessing(sticker.id);

  return NextResponse.json({ ok: true });
}
