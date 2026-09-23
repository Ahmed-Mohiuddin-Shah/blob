import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canApproveUploads } from "@/lib/capabilities";
import { getGlass } from "@/lib/glass";
import { prisma } from "@/lib/prisma";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const upload = await prisma.glassUpload.findUnique({
    where: { id: BigInt(id) },
  });
  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = upload.userId === user.id;
  const isAdmin = canApproveUploads({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const glass = getGlass();
    const res = await glass.objects.download(upload.objectId);
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${upload.title.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    console.error("Glass download failed:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 502 });
  }
}
