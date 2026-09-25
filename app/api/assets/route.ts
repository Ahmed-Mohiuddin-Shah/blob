import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canUpload } from "@/lib/capabilities";
import {
  createAssetFromBytes,
} from "@/lib/composition";
import { prisma } from "@/lib/prisma";
import { MAX_UPLOAD_BYTES } from "@/lib/stickers";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

/** Upload immutable original → assets + GLASS. */
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
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large (max 20 MiB)" }, { status: 400 });
  }

  const widthRaw = String(form.get("width") ?? "").trim();
  const heightRaw = String(form.get("height") ?? "").trim();
  const durationRaw = String(form.get("durationMs") ?? "").trim();

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const asset = await createAssetFromBytes({
      userId: user.id,
      glassPrivatePrismId: user.glassPrivatePrismId,
      bytes,
      declaredMime: file.type || "application/octet-stream",
      title: file.name || "asset",
      width: widthRaw ? Number(widthRaw) : null,
      height: heightRaw ? Number(heightRaw) : null,
      durationMs: durationRaw ? Number(durationRaw) : null,
    });
    return NextResponse.json({
      ok: true,
      id: asset.id,
      mime: asset.mime,
      kind: asset.kind,
    });
  } catch (err) {
    console.error("Asset upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 502 },
    );
  }
}
