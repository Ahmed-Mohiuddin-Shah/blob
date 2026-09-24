import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { StickerMedia } from "@/components/sticker-media";
import { getSession } from "@/lib/auth";
import { canModerate } from "@/lib/capabilities";
import { prisma } from "@/lib/prisma";
import { canAccessSticker, isPublicBrowseable } from "@/lib/stickers";

function typeFromMedia(kinds: string[]): string {
  if (kinds.includes("video")) return "VIDEO";
  if (kinds.includes("gif")) return "GIF";
  return "IMAGE";
}

export default async function StickerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sticker = await prisma.sticker.findUnique({
    where: { slug },
    include: {
      createdBy: { select: { username: true, displayName: true } },
      category: { select: { name: true, slug: true } },
      tags: { include: { tag: true } },
      media: true,
    },
  });
  if (!sticker) notFound();

  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  let viewerId: bigint | null = null;
  let isAdmin = false;
  if (session?.user?.id) {
    const u = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
    });
    if (u) {
      viewerId = u.id;
      isAdmin = canModerate({
        role: u.role,
        accountStatus: u.accountStatus,
      });
    }
  }

  const isOwner =
    viewerId === sticker.uploadedById || viewerId === sticker.createdById;

  if (!canAccessSticker(sticker, { viewerId, isAdmin })) {
    notFound();
  }

  const type = typeFromMedia(sticker.media.map((m) => m.kind));
  const mediaKind =
    type === "VIDEO" ? "video" : type === "GIF" ? "gif" : "image";
  const hasKind = sticker.media.some(
    (m) => m.kind === mediaKind && m.status === "ready",
  );
  const displayKind = hasKind ? mediaKind : "thumbnail";

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-sm">
        <Link href="/stickers" className="text-accent-pink hover:underline">
          ← Stickers
        </Link>
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:items-start">
        <div className="overflow-hidden rounded-[2rem] border border-divider bg-surface">
          <StickerMedia
            src={`/api/stickers/${sticker.id}/media/${displayKind}`}
            seed={sticker.title}
            alt={sticker.title}
            video={type === "VIDEO"}
          />
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-pink">
            {type}
            {sticker.category ? ` · ${sticker.category.name}` : ""}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {sticker.title}
          </h1>
          <p className="mt-2 text-sm text-secondary">
            by {sticker.createdBy.displayName || sticker.createdBy.username}
          </p>

          {sticker.description ? (
            <p className="mt-6 text-sm leading-relaxed text-secondary">
              {sticker.description}
            </p>
          ) : null}

          {sticker.tags.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-2">
              {sticker.tags.map(({ tag }) => (
                <li
                  key={tag.id.toString()}
                  className="rounded-full border border-divider bg-surface px-3 py-1 text-xs text-secondary"
                >
                  {tag.name}
                </li>
              ))}
            </ul>
          ) : null}

          {(isOwner || isAdmin) && !isPublicBrowseable(sticker) ? (
            <p className="mt-6 text-xs text-inactive">
              Status: {sticker.moderationStatus.replaceAll("_", " ")} ·{" "}
              {sticker.processingStatus}
              {sticker.visibility !== "public" ? ` · ${sticker.visibility}` : ""}
            </p>
          ) : null}

          {(isOwner || isAdmin) ? (
            <p className="mt-4">
              <Link
                href={`/stickers/${sticker.slug}/edit`}
                className="text-sm font-semibold text-accent-pink hover:underline"
              >
                Edit metadata
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
