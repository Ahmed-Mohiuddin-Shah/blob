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
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

function typeFromMedia(kinds: string[]): string {
  if (kinds.includes("video")) return "VIDEO";
  if (kinds.includes("gif")) return "GIF";
  return "IMAGE";
}

export default async function HomePage() {
  const reqHeaders = await headers();
  const [session, categories, stickers] = await Promise.all([
    getSession(new Request("http://localhost", { headers: reqHeaders })),
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
      take: 6,
    }),
    prisma.sticker.findMany({
      where: {
        visibility: "public",
        moderationStatus: "approved",
        processingStatus: "ready",
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 6,
      include: {
        createdBy: { select: { displayName: true, username: true } },
        media: { select: { kind: true } },
      },
    }),
  ]);

  const user = session?.user
    ? {
        name: session.user.name,
        displayName: session.user.displayName,
        role: session.user.role,
      }
    : null;

  const popular = categories.slice(0, 4).map((c) => c.name);

  return (
    <>
      <Hero popular={popular} />
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
          author: s.authorName || s.createdBy.displayName || s.createdBy.username,
          sourceUrl: s.sourceUrl,
          type: typeFromMedia(s.media.map((m) => m.kind)),
          href: `/stickers/${s.slug}`,
          thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
        }))}
      />
      <PrintsCta />
      <MemberCta user={user} />
    </>
  );
}
