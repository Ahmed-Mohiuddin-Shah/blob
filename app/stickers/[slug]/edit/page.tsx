import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { StickerEditForm } from "@/components/sticker-edit-form";
import { getSession, signInUrl } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { canAccessSticker, canOwnerEditSticker } from "@/lib/stickers";

export default async function StickerEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  if (!session?.user?.id) {
    redirect(signInUrl({ redirectTo: `/stickers/${slug}/edit` }));
  }

  const user = await prisma.user.findUnique({
    where: { id: BigInt(session.user.id) },
  });
  if (!user) {
    redirect(signInUrl({ redirectTo: `/stickers/${slug}/edit` }));
  }

  const sticker = await prisma.sticker.findUnique({
    where: { slug },
    include: {
      tags: { include: { tag: true } },
      blobber: { select: { id: true, displayName: true, userId: true } },
    },
  });
  if (!sticker) notFound();

  const linked = await prisma.blobber.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  let attributionMode: "self" | "none" | "other" = "none";
  if (sticker.blobberId == null) attributionMode = "none";
  else if (linked && sticker.blobberId === linked.id) attributionMode = "self";
  else attributionMode = "other";

  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  const isOwner =
    sticker.uploadedById === user.id || sticker.createdById === user.id;
  if (
    !isOwner &&
    !(
      isAdmin &&
      canAccessSticker(sticker, { viewerId: user.id, isAdmin: true })
    )
  ) {
    notFound();
  }

  if (!canOwnerEditSticker(sticker.moderationStatus)) {
    redirect(`/stickers/${sticker.slug}`);
  }

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-wider text-inactive">
        Edit sticker
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
        {sticker.title}
      </h1>
      <p className="mt-2 text-sm text-secondary">
        Metadata only — open Edit composition to change the document.
      </p>
      <div className="mt-10">
        <StickerEditForm
          categories={categories.map((c) => ({
            id: c.id.toString(),
            name: c.name,
            slug: c.slug,
          }))}
          initial={{
            id: sticker.id.toString(),
            title: sticker.title,
            description: sticker.description ?? "",
            visibility: sticker.visibility,
            categoryId: sticker.categoryId?.toString() ?? "",
            tags: sticker.tags.map((t) => t.tag.name),
            attributionMode,
            blobber: sticker.blobber
              ? {
                  id: sticker.blobber.id.toString(),
                  displayName: sticker.blobber.displayName,
                }
              : null,
            sourceUrl: sticker.sourceUrl ?? "",
            moderationNote: sticker.moderationNote,
            moderationStatus: sticker.moderationStatus,
          }}
        />
      </div>
    </section>
  );
}
