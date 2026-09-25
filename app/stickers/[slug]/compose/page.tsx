import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StickerComposeForm } from "@/components/sticker-compose-form";
import { canModerate, canUpload } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/require-user";

export default async function ComposePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user } = await requireSessionUser();
  if (!canUpload({ role: user.role, accountStatus: user.accountStatus })) {
    redirect("/profile");
  }

  const sticker = await prisma.sticker.findUnique({
    where: { slug },
    include: { composition: true },
  });
  if (!sticker?.composition?.currentRevisionId) notFound();

  const isOwner =
    sticker.uploadedById === user.id || sticker.createdById === user.id;
  const isAdmin = canModerate({
    role: user.role,
    accountStatus: user.accountStatus,
  });
  if (!isOwner && !isAdmin) notFound();

  const revision = await prisma.compositionRevision.findUnique({
    where: { id: sticker.composition.currentRevisionId },
  });
  if (!revision) notFound();

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-pink">
            Composition
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {sticker.title}
          </h1>
        </div>
        <Link
          href={`/stickers/${sticker.slug}`}
          className="text-sm font-semibold text-secondary hover:text-accent-pink"
        >
          ← Detail
        </Link>
      </div>
      <StickerComposeForm
        stickerId={sticker.id.toString()}
        initialDocument={revision.documentJson}
      />
    </section>
  );
}
