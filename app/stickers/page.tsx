import { StickersLibrary } from "@/components/stickers-library";
import { headers } from "next/headers";
import { getSession, signInUrl } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StickersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
  });

  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  const signedIn = !!session?.user?.id;
  const signInHref = signInUrl({ redirectTo: "/stickers" });

  return (
    <StickersLibrary
      categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
      initialQ={sp.q ?? ""}
      initialCategory={sp.category ?? ""}
      signedIn={signedIn}
      signInHref={signInHref}
    />
  );
}
