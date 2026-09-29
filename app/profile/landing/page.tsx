import { LandingCmsForm } from "@/components/landing-cms-form";
import { MODERATION_STATUS } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/require-user";
import { PROCESSING_STATUS, VISIBILITY } from "@/lib/stickers";

export default async function ProfileLandingPage() {
  await requireSuperadmin();

  const [config, categories, stickers] = await Promise.all([
    prisma.landingConfig.findUnique({ where: { key: "default" } }),
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.sticker.findMany({
      where: {
        visibility: VISIBILITY.public,
        moderationStatus: MODERATION_STATUS.approved,
        processingStatus: PROCESSING_STATUS.ready,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: { id: true, title: true, slug: true },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Landing</h1>
      <p className="mt-1 text-sm text-secondary">
        Curate featured stickers and home category cards. Leave lists empty to
        keep the automatic latest / first-six behavior.
      </p>
      <div className="mt-8">
        <LandingCmsForm
          initialFeaturedIds={(config?.featuredStickerIds ?? []).map(String)}
          initialCategoryIds={(config?.categoryIds ?? []).map(String)}
          categories={categories.map((c) => ({
            id: c.id.toString(),
            name: c.name,
            slug: c.slug,
          }))}
          stickers={stickers.map((s) => ({
            id: s.id.toString(),
            title: s.title,
            slug: s.slug,
          }))}
        />
      </div>
    </div>
  );
}
