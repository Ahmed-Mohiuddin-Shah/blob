import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { FavouriteButton } from "@/components/favourite-button";
import { CollectionDetailActions } from "@/components/collection-detail-actions";
import { CollectionPrintActions } from "@/components/collection-print-actions";
import { RemoveFromCollectionButton } from "@/components/remove-from-collection-button";
import { StickerGrid } from "@/components/sticker-grid";
import { getSession, signInUrl } from "@/lib/auth";
import { COLLECTION_ITEM } from "@/lib/collections";
import { FAVORITE_SUBJECT } from "@/lib/favorites";
import { PRINT_STATUS } from "@/lib/prints";
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
      items: {
        orderBy: [{ sortOrder: "asc" }, { addedAt: "asc" }],
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

  const stickerIds = collection.items
    .filter((i) => i.subjectType === COLLECTION_ITEM.sticker)
    .map((i) => i.subjectId);
  const sheetIds = collection.items
    .filter((i) => i.subjectType === COLLECTION_ITEM.stickerSheet)
    .map((i) => i.subjectId);
  const packIds = collection.items
    .filter((i) => i.subjectType === COLLECTION_ITEM.stickerPack)
    .map((i) => i.subjectId);

  const [stickers, sheets, packs] = await Promise.all([
    stickerIds.length
      ? prisma.sticker.findMany({
          where: { id: { in: stickerIds } },
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
        })
      : Promise.resolve([]),
    sheetIds.length
      ? prisma.stickerSheet.findMany({
          where: { id: { in: sheetIds } },
          include: {
            createdBy: { select: { username: true, displayName: true } },
            stickers: { select: { stickerId: true } },
          },
        })
      : Promise.resolve([]),
    packIds.length
      ? prisma.stickerPack.findMany({
          where: { id: { in: packIds } },
          include: {
            createdBy: { select: { username: true, displayName: true } },
            sheets: {
              orderBy: { sortOrder: "asc" },
              select: { sheetId: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const stickerMap = new Map(stickers.map((s) => [s.id.toString(), s]));
  const sheetMap = new Map(sheets.map((s) => [s.id.toString(), s]));
  const packMap = new Map(packs.map((p) => [p.id.toString(), p]));

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
          subjectId: { in: stickerIds },
        },
        select: { subjectId: true },
      }),
    ]);
    favourited = !!fav;
    favouritedStickerIds = new Set(
      stickerFavs.map((f) => f.subjectId.toString()),
    );
  }

  const signInHref = signInUrl({
    redirectTo: `/collections/${collection.slug}`,
  });
  const canRemove = isOwner && collection.items.length > 1;

  function mediaLabel(kinds: string[]): string {
    if (kinds.includes(MEDIA_KIND.video)) return "VIDEO";
    if (kinds.includes(MEDIA_KIND.gif)) return "GIF";
    return "IMAGE";
  }

  const stickerCards = collection.items
    .filter((i) => i.subjectType === COLLECTION_ITEM.sticker)
    .map((i) => stickerMap.get(i.subjectId.toString()))
    .filter(Boolean)
    .map((s) => ({
      stickerId: s!.id.toString(),
      title: s!.title,
      author:
        s!.authorName || s!.createdBy.displayName || s!.createdBy.username,
      sourceUrl: s!.sourceUrl,
      type: mediaLabel(s!.media.map((m) => m.kind)),
      href: `/stickers/${s!.slug}`,
      thumbUrl: `/api/stickers/${s!.id}/media/thumbnail`,
      remixHref: `/stickers/${s!.slug}/remix`,
      favourited: favouritedStickerIds.has(s!.id.toString()),
      signedIn,
      signInHref,
      showActions: true,
      ...(isOwner
        ? {
            collectionSlug: collection.slug,
            canRemoveFromCollection: canRemove,
          }
        : {}),
    }));

  const readySheets = sheets.filter((s) => s.status === PRINT_STATUS.ready);
  const readyPacks = packs.filter((p) => p.status === PRINT_STATUS.ready);

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-sm">
        <Link href="/collections" className="text-accent-pink hover:underline">
          ← Collections
        </Link>
      </p>

      <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-accent-pink">
        Collection · {collection.items.length}/60
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
          initialLikesCount={Number(collection.likesCount)}
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
        <CollectionPrintActions
          collectionSlug={collection.slug}
          stickerIds={stickerIds.map((id) => id.toString())}
          sheetIds={readySheets.map((s) => s.id.toString())}
          packIds={readyPacks.map((p) => p.id.toString())}
          packSheetIds={readyPacks.flatMap((p) =>
            p.sheets.map((ps) => ps.sheetId.toString()),
          )}
          signedIn={signedIn}
          signInHref={signInHref}
        />
      </div>

      {readySheets.length > 0 || readyPacks.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {readySheets.map((s) => (
            <div
              key={s.id.toString()}
              className="relative overflow-hidden rounded-[1.5rem] border border-divider bg-surface"
            >
              <Link href={`/prints/sheets/${s.slug}`} className="block">
                <div className="aspect-[3/4] bg-badge">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/sheets/${s.id}/media/png`}
                    alt=""
                    className="h-full w-full object-contain p-2"
                  />
                </div>
                <p className="truncate px-3 py-2 text-sm font-semibold">
                  {s.name}
                </p>
              </Link>
              {isOwner ? (
                <RemoveFromCollectionButton
                  collectionSlug={collection.slug}
                  subjectType={COLLECTION_ITEM.stickerSheet}
                  subjectId={s.id.toString()}
                  canRemove={canRemove}
                />
              ) : null}
            </div>
          ))}
          {readyPacks.map((p) => (
            <div
              key={p.id.toString()}
              className="relative overflow-hidden rounded-[1.5rem] border border-divider bg-surface"
            >
              <Link href={`/prints/packs/${p.slug}`} className="block">
                <div className="aspect-square bg-badge">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/packs/${p.id}/media/png`}
                    alt=""
                    className="h-full w-full object-contain p-2"
                  />
                </div>
                <p className="truncate px-3 py-2 text-sm font-semibold">
                  {p.name}
                </p>
              </Link>
              {isOwner ? (
                <RemoveFromCollectionButton
                  collectionSlug={collection.slug}
                  subjectType={COLLECTION_ITEM.stickerPack}
                  subjectId={p.id.toString()}
                  canRemove={canRemove}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-10">
        <StickerGrid items={stickerCards} />
      </div>
    </section>
  );
}
