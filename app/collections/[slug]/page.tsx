import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { FavouriteButton } from "@/components/favourite-button";
import { CollectionDetailActions } from "@/components/collection-detail-actions";
import { StickerGrid } from "@/components/sticker-grid";
import { getSession, signInUrl } from "@/lib/auth";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { prisma } from "@/lib/prisma";
import {
  CARD_MEDIA_KINDS,
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
} from "@/lib/stickers";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await prisma.collection.findUnique({
    where: { slug },
    include: {
      user: { select: { username: true, displayName: true } },
      tags: { include: { tag: true } },
      stickers: {
        orderBy: [{ sortOrder: "asc" }, { addedAt: "asc" }],
        include: {
          sticker: {
            include: {
              createdBy: { select: { username: true, displayName: true } },
              media: {
                where: {
                  kind: { in: [...CARD_MEDIA_KINDS] },
                  status: MEDIA_ASSET_STATUS.ready,
                },
                select: { kind: true },
              },
            },
          },
        },
      },
    },
  });
  if (!collection) notFound();

  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  let viewerId: bigint | null = null;
  const signedIn = !!session?.user?.id;
  if (session?.user?.id) {
    viewerId = BigInt(session.user.id);
  }
  const isOwner = viewerId === collection.userId;

  let favourited = false;
  let favouritedStickerIds = new Set<string>();
  if (viewerId) {
    const [fav, stickerFavs] = await Promise.all([
      prisma.favorite.findUnique({
        where: {
          userId_subjectType_subjectId: {
            userId: viewerId,
            subjectType: FAVORITE_SUBJECT.collection,
            subjectId: collection.id,
          },
        },
      }),
      prisma.favorite.findMany({
        where: {
          userId: viewerId,
          subjectType: FAVORITE_SUBJECT.sticker,
          subjectId: { in: collection.stickers.map((cs) => cs.stickerId) },
        },
        select: { subjectId: true },
      }),
    ]);
    favourited = !!fav;
    favouritedStickerIds = new Set(stickerFavs.map((f) => f.subjectId.toString()));
  }

  const signInHref = signInUrl({
    redirectTo: `/collections/${collection.slug}`,
  });

  function mediaLabel(kinds: string[]): string {
    if (kinds.includes(MEDIA_KIND.video)) return "VIDEO";
    if (kinds.includes(MEDIA_KIND.gif)) return "GIF";
    return "IMAGE";
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-sm">
        <Link href="/collections" className="text-accent-pink hover:underline">
          ← Collections
        </Link>
      </p>

      <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-accent-pink">
        Collection · {collection.stickers.length}/60
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        {collection.name}
      </h1>
      <p className="mt-2 text-sm text-secondary">
        by {collection.user.displayName || collection.user.username}
      </p>

      {collection.description ? (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-secondary">
          {collection.description}
        </p>
      ) : null}

      {collection.tags.length > 0 ? (
        <ul className="mt-6 flex flex-wrap gap-2">
          {collection.tags.map(({ tag }) => (
            <li
              key={tag.id.toString()}
              className="rounded-full border border-divider bg-surface px-3 py-1 text-xs text-secondary"
            >
              {tag.name}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <FavouriteButton
          subjectType={FAVORITE_SUBJECT.collection}
          subjectId={collection.id.toString()}
          initialFavourited={favourited}
          signedIn={signedIn}
          signInHref={signInHref}
          variant="pill"
        />
        {isOwner ? (
          <CollectionDetailActions
            slug={collection.slug}
            name={collection.name}
            description={collection.description ?? ""}
            tags={collection.tags.map(({ tag }) => tag.name).join(", ")}
          />
        ) : null}
      </div>

      <div className="mt-10">
        <StickerGrid
          items={collection.stickers.map(({ sticker: s }) => ({
            stickerId: s.id.toString(),
            title: s.title,
            author:
              s.authorName || s.createdBy.displayName || s.createdBy.username,
            sourceUrl: s.sourceUrl,
            type: mediaLabel(s.media.map((m) => m.kind)),
            href: `/stickers/${s.slug}`,
            thumbUrl: `/api/stickers/${s.id}/media/thumbnail`,
            remixHref: `/stickers/${s.slug}/remix`,
            favourited: favouritedStickerIds.has(s.id.toString()),
            signedIn,
            signInHref,
            showActions: true,
            ...(isOwner
              ? {
                  collectionSlug: collection.slug,
                  canRemoveFromCollection: collection.stickers.length > 1,
                }
              : {}),
          }))}
        />
      </div>
    </section>
  );
}
