import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canUpload } from "@/lib/capabilities";
import { getGlass, GLASS_UPLOAD_STATUS } from "@/lib/glass";
import { prisma } from "@/lib/prisma";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

async function ensurePrivatePrism(userId: bigint, existing: string | null) {
  if (existing) return existing;
  const glass = getGlass();
  const prism = await glass.prisms.create({
    label: `blob-user-${userId}`,
    is_public: false,
  });
  await prisma.user.update({
    where: { id: userId },
    data: { glassPrivatePrismId: prism.id },
  });
  return prism.id;
}

export async function POST(request: Request) {
  const user = await sessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUpload({ role: user.role, accountStatus: user.accountStatus })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const maxBytes = 20 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "File too large (max 20 MiB)" }, { status: 400 });
  }

  try {
    const prismId = await ensurePrivatePrism(
      user.id,
      user.glassPrivatePrismId,
    );
    const glass = getGlass();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await glass.objects.upload({
      prismId,
      file: bytes,
      title: file.name,
      filename: file.name,
    });

    const row = await prisma.glassUpload.create({
      data: {
        userId: user.id,
        objectId: uploaded.object_id,
        prismId,
        title: file.name.slice(0, 200),
        size: uploaded.size,
        status: GLASS_UPLOAD_STATUS.pending,
      },
    });

    return NextResponse.json({
      id: row.id.toString(),
      objectId: row.objectId,
      status: row.status,
    });
  } catch (err) {
    console.error("Glass upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 502 },
    );
  }
}
