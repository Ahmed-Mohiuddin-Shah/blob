import { StickersLibrary } from "@/components/stickers-library";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getSession, signInUrl } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listBrowseStickers } from "@/lib/stickers-browse";

export const metadata: Metadata = {
  title: "Stickers",
  description: "Browse the public BLOB sticker library.",
};

export default async function StickersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const initialQ = sp.q ?? "";
  const initialCategory = sp.category ?? "";

  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  const signedIn = !!session?.user?.id;
  const signInHref = signInUrl({ redirectTo: "/stickers" });
  const userId = session?.user?.id ? BigInt(session.user.id) : null;

  const [categories, dbUser] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: "asc" },
    }),
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, accountStatus: true },
        })
      : Promise.resolve(null),
  ]);

  const { items, nextCursor } = await listBrowseStickers({
    q: initialQ,
    category: initialCategory,
    user: dbUser
      ? {
          id: dbUser.id,
          role: dbUser.role,
          accountStatus: dbUser.accountStatus,
        }
      : null,
  });

  return (
    <StickersLibrary
      key={`${initialQ}\0${initialCategory}`}
      categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
      initialQ={initialQ}
      initialCategory={initialCategory}
      signedIn={signedIn}
      signInHref={signInHref}
      initialItems={items}
      initialCursor={nextCursor}
    />
  );
}
