import type { MetadataRoute } from "next";
import { MODERATION_STATUS } from "@/lib/moderation";
import { PRINT_STATUS } from "@/lib/prints";
import { prisma } from "@/lib/prisma";
import { publicSiteUrl } from "@/lib/site-url";
import { VISIBILITY } from "@/lib/stickers";

// ponytail: Docker build has no DATABASE_URL; sitemap must not prerender.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicSiteUrl();
  const now = new Date();

  const staticPaths = [
    "/",
    "/about",
    "/terms",
    "/privacy",
    "/search",
    "/stickers",
    "/collections",
    "/blobbers",
    "/prints",
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" || path === "/search" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));

  const [stickers, collections, blobbers, sheets, packs] = await Promise.all([
    prisma.sticker.findMany({
      where: {
        moderationStatus: MODERATION_STATUS.approved,
        visibility: VISIBILITY.public,
      },
      select: { slug: true, updatedAt: true },
      orderBy: { id: "asc" },
      take: 40_000,
    }),
    prisma.collection.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { id: "asc" },
      take: 10_000,
    }),
    prisma.blobber.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { id: "asc" },
      take: 10_000,
    }),
    prisma.stickerSheet.findMany({
      where: { status: PRINT_STATUS.ready },
      select: { slug: true, updatedAt: true },
      orderBy: { id: "asc" },
      take: 5_000,
    }),
    prisma.stickerPack.findMany({
      where: { status: PRINT_STATUS.ready },
      select: { slug: true, updatedAt: true },
      orderBy: { id: "asc" },
      take: 5_000,
    }),
  ]);

  for (const s of stickers) {
    entries.push({
      url: `${base}/stickers/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }
  for (const c of collections) {
    entries.push({
      url: `${base}/collections/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }
  for (const b of blobbers) {
    entries.push({
      url: `${base}/blobbers/${b.slug}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly",
      priority: 0.5,
    });
  }
  for (const s of sheets) {
    entries.push({
      url: `${base}/prints/sheets/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }
  for (const p of packs) {
    entries.push({
      url: `${base}/prints/packs/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  return entries;
}
