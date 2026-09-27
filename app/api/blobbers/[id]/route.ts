import { NextResponse } from "next/server";
import { liveCmsSnapshot } from "@/lib/blobbers";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let blobberId: bigint;
  try {
    blobberId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const blobber = await prisma.blobber.findUnique({
    where: { id: blobberId },
    include: {
      user: { select: { username: true } },
      socialLinks: { include: { socialLink: true } },
    },
  });
  if (!blobber) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const live = liveCmsSnapshot(blobber);
  return NextResponse.json({
    id: blobber.id.toString(),
    ...live,
    username: blobber.user?.username ?? null,
    linked: blobber.userId != null,
  });
}
