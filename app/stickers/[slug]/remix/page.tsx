import { notFound, redirect } from "next/navigation";
import { remixDeepCopy, validateDocument } from "blob-editor/core";
import { StickerCreateForm } from "@/components/sticker-create-form";
import { canModerate, canUpload } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/require-user";
import { canAccessSticker } from "@/lib/stickers";

export default async function RemixPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireSessionUser();
  if (!canUpload({ role: user.role, accountStatus: user.accountStatus })) {
    redirect("/profile");
  }

  const source = await prisma.sticker.findUnique({
    where: { slug },
    include: { composition: true },
  });
  if (!source?.composition?.currentRevisionId) notFound();

  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  if (!canAccessSticker(source, { viewerId: user.id, isAdmin })) {
    notFound();
  }

  const revision = await prisma.compositionRevision.findUnique({
    where: { id: source.composition.currentRevisionId },
  });
  if (!revision) notFound();

  const document = remixDeepCopy(validateDocument(revision.documentJson));

  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-pink">
          Remix
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Remix {source.title}
        </h1>
        <p className="mt-2 text-sm text-secondary">
          Deep-copies the composition and reuses the same originals. Your edits
          become a new sticker.
        </p>
      </div>
      <div className="mt-10">
        <StickerCreateForm
          categories={categories.map((c) => ({
            id: c.id.toString(),
            name: c.name,
            slug: c.slug,
          }))}
          initialDocument={document}
          remixedFromStickerId={source.id.toString()}
          parentCompositionId={source.composition.id.toString()}
          defaultTitle={`Remix of ${source.title}`.slice(0, 200)}
        />
      </div>
    </section>
  );
}
