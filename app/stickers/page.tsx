import { StickersLibrary } from "@/components/stickers-library";
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

  return (
    <StickersLibrary
      categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
      initialQ={sp.q ?? ""}
      initialCategory={sp.category ?? ""}
    />
  );
}
