import { headers } from "next/headers";
import {
  Cat,
  Clapperboard,
  Dices,
  Gamepad2,
  Globe,
  Laugh,
  Sparkles,
  Users,
  Smile,
  type LucideIcon,
} from "lucide-react";
import { Categories } from "@/components/home/categories";
import { Featured } from "@/components/home/featured";
import { Hero } from "@/components/home/hero";
import { MemberCta } from "@/components/home/member-cta";
import { PrintsCta } from "@/components/home/prints-cta";
import { SearchUpsell } from "@/components/home/search-upsell";
import { getSession } from "@/lib/auth";
import {
  canUseSearchMode,
  defaultSearchMode,
  type CapabilityUser,
} from "@/lib/capabilities";
import { MODERATION_STATUS } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { blobberPublicHref } from "@/lib/blobbers";
import {
  PROCESSING_STATUS,
  VISIBILITY,
  stickerPreviewUrl,
  stickerTypeFromKinds,
  videoHasAudio,
} from "@/lib/stickers";

const CATEGORY_ICONS: Record<string, { icon: LucideIcon; className: string }> = {
  reactions: { icon: Smile, className: "bg-accent-gradient" },
  animals: { icon: Cat, className: "bg-accent-orange" },
  memes: { icon: Laugh, className: "bg-metro-pink" },
  gaming: { icon: Gamepad2, className: "bg-metro-orange" },
  anime: { icon: Sparkles, className: "bg-accent-pink" },
  people: { icon: Users, className: "bg-accent-orange" },
  movies: { icon: Clapperboard, className: "bg-metro-pink" },
  internet: { icon: Globe, className: "bg-accent-pink" },
  miscellaneous: { icon: Dices, className: "bg-accent-orange" },
};

const stickerCardSelect = {
  createdBy: { select: { displayName: true, username: true } },
  blobber: { select: { id: true, displayName: true, slug: true } },
  media: { select: { kind: true, status: true, hasAudio: true } },
} as const;

export default async function HomePage() {
  const reqHeaders = await headers();
  const [session, landing, autoCategories, autoStickers] = await Promise.all([
    getSession(new Request("http://localhost", { headers: reqHeaders })),
    prisma.landingConfig.findUnique({ where: { key: "default" } }),
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      take: 6,
    }),
    prisma.sticker.findMany({
      where: {
        visibility: VISIBILITY.public,
        moderationStatus: MODERATION_STATUS.approved,
        processingStatus: PROCESSING_STATUS.ready,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 6,
      include: stickerCardSelect,
    }),
  ]);

  const capUser: CapabilityUser | null = session?.user?.id
    ? {
        role: session.user.role ?? "user",
        accountStatus: session.user.accountStatus ?? "active",
      }
    : null;

  let categories = autoCategories;
  if (landing?.categoryIds.length) {
    const curated = await prisma.category.findMany({
      where: { id: { in: landing.categoryIds } },
    });
    const byId = new Map(curated.map((c) => [c.id.toString(), c]));
    categories = landing.categoryIds
      .map((id) => byId.get(id.toString()))
      .filter((c): c is (typeof curated)[number] => !!c);
  }

  let stickers = autoStickers;
  if (landing?.featuredStickerIds.length) {
    const curated = await prisma.sticker.findMany({
      where: {
        id: { in: landing.featuredStickerIds },
        visibility: VISIBILITY.public,
        moderationStatus: MODERATION_STATUS.approved,
        processingStatus: PROCESSING_STATUS.ready,
      },
      include: stickerCardSelect,
    });
    const byId = new Map(curated.map((s) => [s.id.toString(), s]));
    stickers = landing.featuredStickerIds
      .map((id) => byId.get(id.toString()))
      .filter((s): s is (typeof curated)[number] => !!s);
  }

  const user = session?.user
    ? {
        name: session.user.name,
        displayName: session.user.displayName,
        role: session.user.role,
      }
    : null;

  const popular = categories.slice(0, 4).map((c) => c.name);
  const searchMode = defaultSearchMode(capUser);
  const showCamera = canUseSearchMode(capUser, "visual");

  return (
    <>
      <Hero
        popular={popular}
        searchMode={searchMode}
        showCamera={showCamera}
      />
      <Categories
        categories={categories.map((c) => {
          const meta = CATEGORY_ICONS[c.slug] ?? {
            icon: Dices,
            className: "bg-accent-gradient",
          };
          return {
            name: c.name,
            slug: c.slug,
            icon: meta.icon,
            className: meta.className,
          };
        })}
      />
      <Featured
        stickers={stickers.map((s) => ({
          title: s.title,
          author: s.blobber?.displayName ?? "",
          sourceUrl: s.sourceUrl,
          blobberHref: s.blobber ? blobberPublicHref(s.blobber) : null,
          type: stickerTypeFromKinds(s.media.map((m) => m.kind)),
          href: `/stickers/${s.slug}`,
          thumbUrl: stickerPreviewUrl(s.id, s.media),
          hasAudio: videoHasAudio(s.media),
        }))}
      />
      <SearchUpsell user={user} />
      <PrintsCta />
      <MemberCta user={user} />
    </>
  );
}
