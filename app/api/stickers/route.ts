import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { canUpload } from "@/lib/capabilities";
import { getGlass } from "@/lib/glass";
import { prisma } from "@/lib/prisma";
import { ensurePrivatePrism } from "@/lib/private-prism";
import { enqueueStickerProcessing } from "@/lib/sticker-process-stub";
import {
  detectUpload,
  FIT_MODES,
  MAX_UPLOAD_BYTES,
  slugify,
  tagSlug,
  VISIBILITIES,
  type FitMode,
  type Visibility,
} from "@/lib/stickers";

async function sessionUser() {
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: BigInt(session.user.id) } });
}

const PAGE = 24;

/** Public browse + search (cursor pagination). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const cursor = url.searchParams.get("cursor");

  const where: {
    visibility: string;
    moderationStatus: string;
    processingStatus: string;
    OR?: object[];
    category?: { slug: string };
  } = {
    visibility: "public",
    moderationStatus: "approved",
    processingStatus: "ready",
  };

  if (category) {
    where.category = { slug: category };
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { keywords: { contains: q, mode: "insensitive" } },
      { alternateNames: { contains: q, mode: "insensitive" } },
      { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
      { category: { name: { contains: q, mode: "insensitive" } } },
      { createdBy: { username: { contains: q, mode: "insensitive" } } },
      { createdBy: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.sticker.findMany({
    where,
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: BigInt(cursor) }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      createdBy: { select: { username: true, displayName: true } },
      category: { select: { slug: true, name: true } },
      media: {
        where: { kind: { in: ["thumbnail", "image", "gif", "video"] }, status: "ready" },
        select: { kind: true },
      },
    },
  });

  const hasMore = rows.length > PAGE;
  const page = hasMore ? rows.slice(0, PAGE) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.id.toString() : null;

  return NextResponse.json({
    items: page.map((s) => ({
      id: s.id.toString(),
      title: s.title,
      slug: s.slug,
      author: s.createdBy.displayName || s.createdBy.username,
      username: s.createdBy.username,
      category: s.category?.name ?? null,
      categorySlug: s.category?.slug ?? null,
      type: mediaLabel(s.media.map((m) => m.kind)),
      href: `/stickers/${s.slug}`,
      thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
    })),
    nextCursor,
  });
}

function mediaLabel(kinds: string[]): string {
  if (kinds.includes("video")) return "VIDEO";
  if (kinds.includes("gif")) return "GIF";
  return "IMAGE";
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
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large (max 20 MiB)" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  if (!title || title.length > 200) {
    return NextResponse.json({ error: "title required (max 200)" }, { status: 400 });
  }

  const description = String(form.get("description") ?? "").trim() || null;
  const fitModeRaw = String(form.get("fitMode") ?? "pad");
  const fitMode = (FIT_MODES.includes(fitModeRaw as FitMode) ? fitModeRaw : "pad") as FitMode;
  let padBackground = String(form.get("padBackground") ?? "transparent").trim();
  if (fitMode === "pad") {
    if (padBackground !== "transparent" && !/^#[0-9a-fA-F]{6}$/.test(padBackground)) {
      padBackground = "transparent";
    }
  } else {
    padBackground = "transparent";
  }

  const visibilityRaw = String(form.get("visibility") ?? "public");
  const visibility = (
    VISIBILITIES.includes(visibilityRaw as Visibility) ? visibilityRaw : "public"
  ) as Visibility;

  const categoryIdRaw = String(form.get("categoryId") ?? "").trim();
  let categoryId: bigint | null = null;
  if (categoryIdRaw) {
    const cat = await prisma.category.findUnique({ where: { id: BigInt(categoryIdRaw) } });
    if (!cat) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    categoryId = cat.id;
  }

  const tagsRaw = String(form.get("tags") ?? "");
  const tagNames = tagsRaw
    .split(/[,#\n]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectUpload(bytes, file.type || "application/octet-stream");
  if (!detected) {
    return NextResponse.json(
      { error: "Unsupported file type (png, jpeg, webp, gif, mp4)" },
      { status: 400 },
    );
  }

  const baseSlug = slugify(title);
  let slug = baseSlug;
  for (let i = 0; i < 8; i++) {
    const taken = await prisma.sticker.findUnique({ where: { slug } });
    if (!taken) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  }

  try {
    const prismId = await ensurePrivatePrism(user.id, user.glassPrivatePrismId);
    const glass = getGlass();
    const uploaded = await glass.objects.upload({
      prismId,
      file: bytes,
      title,
      filename: `${slug}.${detected.ext}`,
    });

    const sticker = await prisma.$transaction(async (tx) => {
      const s = await tx.sticker.create({
        data: {
          title,
          description,
          slug,
          createdById: user.id,
          uploadedById: user.id,
          categoryId,
          visibility,
          moderationStatus: "pending_review",
          processingStatus: "processing",
          fitMode,
          padBackground,
        },
      });

      await tx.mediaAsset.create({
        data: {
          stickerId: s.id,
          kind: "original",
          mimeType: detected.mime,
          fileExtension: detected.ext,
          sizeBytes: BigInt(uploaded.size ?? bytes.length),
          glassObjectId: uploaded.object_id,
          glassPrismId: prismId,
          status: "pending",
        },
      });

      for (const name of tagNames) {
        const tSlug = tagSlug(name);
        if (!tSlug) continue;
        const tag = await tx.tag.upsert({
          where: { slug: tSlug },
          create: { slug: tSlug, name: name.slice(0, 80) },
          update: {},
        });
        await tx.stickerTag.create({
          data: { stickerId: s.id, tagId: tag.id },
        });
      }

      return s;
    });

    enqueueStickerProcessing(sticker.id);

    return NextResponse.json({
      ok: true,
      id: sticker.id.toString(),
      slug: sticker.slug,
    });
  } catch (err) {
    console.error("Sticker upload failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 502 },
    );
  }
}
