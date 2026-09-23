import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canApproveUploads } from "@/lib/capabilities";
import { getGlass, getPublicPrismId } from "@/lib/glass";
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
    !canApproveUploads({
      role: admin.role,
      accountStatus: admin.accountStatus,
    })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const upload = await prisma.glassUpload.findUnique({
    where: { id: BigInt(id) },
  });
  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (upload.status === "approved") {
    return NextResponse.json({ ok: true, status: "approved" });
  }

  try {
    const glass = getGlass();
    const publicId = await getPublicPrismId();
    await glass.prisms.linkObject(publicId, upload.objectId);
    if (upload.prismId !== publicId) {
      await glass.prisms.unlinkObject(upload.prismId, upload.objectId);
    }
    await prisma.glassUpload.update({
      where: { id: upload.id },
      data: { status: "approved", prismId: publicId },
    });
    return NextResponse.json({ ok: true, status: "approved" });
  } catch (err) {
    console.error("Approve upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approve failed" },
      { status: 502 },
    );
  }
}
