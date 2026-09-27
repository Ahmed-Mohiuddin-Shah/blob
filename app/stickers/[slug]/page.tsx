import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Blender, Volume2, VolumeX } from "lucide-react";
import { AddToCollectionButton } from "@/components/add-to-collection-button";
import { AttributionClaimForm } from "@/components/attribution-claim-form";
import { AttributionCredit } from "@/components/attribution-credit";
import { FavouriteButton } from "@/components/favourite-button";
import { StickerCard, type StickerCardProps } from "@/components/sticker-card";
import { StickerDownloadButtons } from "@/components/sticker-download-buttons";
import { StickerFailedActions } from "@/components/sticker-failed-actions";
import { StickerMedia } from "@/components/sticker-media";
import { getSession, signInUrl } from "@/lib/auth";
import { CLAIM_STATUS } from "@/lib/attribution";
import { canModerate, canUpload } from "@/lib/capabilities";
import { COLLECTION_ITEM, isInUserCollection } from "@/lib/collections";
import { FAVORITE_SUBJECT, isFavourited } from "@/lib/favorites";
import { MODERATION_STATUS } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { relatedStickers } from "@/lib/search/query";
import {
  MEDIA_ASSET_STATUS,
  PROCESSING_STATUS,
  VISIBILITY,
  canAccessSticker,
  canOwnerEditSticker,
  isPublicBrowseable,
  previewMediaKind,
  stickerTypeFromKinds,
  videoHasAudio,
} from "@/lib/stickers";

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
      blobber: { select: { id: true, displayName: true } },
      category: { select: { name: true, slug: true } },
      tags: { include: { tag: true } },
      media: true,
      remixedFrom: { select: { slug: true, title: true } },
    },
  });
  if (!sticker) notFound();

  const reqHeaders = await headers();
  const session = await getSession(
    new Request("http://localhost", { headers: reqHeaders }),
  );
  let viewerId: bigint | null = null;
  let isAdmin = false;
  let canRemix = false;
  let contactDefaults: { contactName: string; contactEmail: string } | undefined;
  let claimBlobber: { id: string; displayName: string } | null = null;
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
      canRemix = canUpload({
        role: u.role,
        accountStatus: u.accountStatus,
      });
      contactDefaults = {
        contactName: u.displayName,
        contactEmail: u.email,
      };
      const linked = await prisma.blobber.findUnique({
        where: { userId: u.id },
        select: { id: true, displayName: true },
      });
      if (linked) {
        claimBlobber = {
          id: linked.id.toString(),
          displayName: linked.displayName,
        };
      }
    }
  }

  const isOwner =
    viewerId === sticker.uploadedById || viewerId === sticker.createdById;

  if (!canAccessSticker(sticker, { viewerId, isAdmin })) {
    notFound();
  }

  const pendingClaim =
    viewerId != null
      ? await prisma.attributionClaim.findFirst({
        where: {
          stickerId: sticker.id,
          claimantId: viewerId,
          status: CLAIM_STATUS.pending,
        },
        select: { id: true },
      })
      : null;

  let favourited = false;
  let inCollection = false;
  if (viewerId) {
    favourited = await isFavourited(
      viewerId,
      FAVORITE_SUBJECT.sticker,
      sticker.id,
    );
    inCollection = await isInUserCollection(
      viewerId,
      COLLECTION_ITEM.sticker,
      sticker.id,
    );
  }

  const type = stickerTypeFromKinds(sticker.media.map((m) => m.kind));
  const displayKind = previewMediaKind(sticker.media);
  const hasAudio = videoHasAudio(sticker.media);
  const SoundIcon = hasAudio ? Volume2 : VolumeX;

  const creditLabel = sticker.blobber?.displayName ?? "";
  const blobberHref = sticker.blobber ? `/blobbers/${sticker.blobber.id}` : null;

  let relatedCards: StickerCardProps[] = [];
  if (isPublicBrowseable(sticker)) {
    const hits = (await relatedStickers(sticker.id, 5)).slice(0, 5);
    const ids = hits
      .map((h) => {
        try {
          return BigInt(h.id);
        } catch {
          return null;
        }
      })
      .filter((x): x is bigint => x != null);
    if (ids.length) {
      const rows = await prisma.sticker.findMany({
        where: { id: { in: ids } },
        include: {
          blobber: { select: { id: true, displayName: true } },
          createdBy: { select: { displayName: true, username: true } },
          media: {
            where: { status: MEDIA_ASSET_STATUS.ready },
            select: { kind: true, hasAudio: true, status: true },
          },
        },
      });
      const byId = new Map(rows.map((r) => [r.id.toString(), r]));
      relatedCards = ids
        .map((id) => byId.get(id.toString()))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map((r) => {
          const type = stickerTypeFromKinds(r.media.map((m) => m.kind));
          return {
            title: r.title,
            author:
              r.blobber?.displayName ||
              r.createdBy.displayName ||
              r.createdBy.username,
            blobberHref: r.blobber ? `/blobbers/${r.blobber.id}` : null,
            type,
            href: `/stickers/${r.slug}`,
            thumbUrl: `/api/stickers/${r.id}/media/thumbnail`,
            stickerId: r.id.toString(),
            hasAudio: type === "VIDEO" ? videoHasAudio(r.media) : null,
          };
        });
    }
  }

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
          />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-pink">
              {type}
              {sticker.category ? ` · ${sticker.category.name}` : ""}
            </p>
            {hasAudio !== null ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-secondary">
                <SoundIcon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                {hasAudio ? "Sound" : "No sound"}
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {sticker.title}
          </h1>
          <div className="mt-2">
            <AttributionCredit
              label={creditLabel}
              sourceUrl={sticker.sourceUrl}
              blobberHref={blobberHref}
              showInfo={!!sticker.sourceUrl}
              className="text-sm [&_span]:text-sm"
            />
          </div>

          {sticker.remixedFrom ? (
            <p className="mt-3 text-sm text-secondary">
              Remixed from{" "}
              <Link
                href={`/stickers/${sticker.remixedFrom.slug}`}
                className="font-semibold text-accent-pink hover:underline"
              >
                {sticker.remixedFrom.title}
              </Link>
            </p>
          ) : null}

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

          <StickerDownloadButtons
            stickerId={sticker.id.toString()}
            useGlassDirect={
              sticker.visibility === VISIBILITY.public &&
              sticker.moderationStatus === MODERATION_STATUS.approved &&
              sticker.processingStatus === PROCESSING_STATUS.ready
            }
            media={sticker.media.map((m) => ({
              kind: m.kind,
              status: m.status,
              glassObjectId: m.glassObjectId,
            }))}
          />

          {(isOwner || isAdmin) && !isPublicBrowseable(sticker) ? (
            <p className="mt-6 text-xs text-inactive">
              Status: {sticker.moderationStatus.replaceAll("_", " ")} ·{" "}
              {sticker.processingStatus}
              {sticker.visibility !== VISIBILITY.public
                ? ` · ${sticker.visibility}`
                : ""}
            </p>
          ) : null}

          {(isOwner || isAdmin) &&
          sticker.processingStatus === PROCESSING_STATUS.failed ? (
            <StickerFailedActions
              stickerId={sticker.id.toString()}
              processingError={sticker.processingError}
            />
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <FavouriteButton
              subjectType={FAVORITE_SUBJECT.sticker}
              subjectId={sticker.id.toString()}
              initialFavourited={favourited}
              initialLikesCount={Number(sticker.likesCount)}
              signedIn={!!viewerId}
              signInHref={signInUrl({ redirectTo: `/stickers/${sticker.slug}` })}
              variant="pill"
            />
            <AddToCollectionButton
              stickerId={sticker.id.toString()}
              initialInCollection={inCollection}
              signedIn={!!viewerId}
              signInHref={signInUrl({ redirectTo: `/stickers/${sticker.slug}` })}
              variant="pill"
            />
            {canRemix ? (
              <Link
                href={`/stickers/${sticker.slug}/remix`}
                className="inline-flex items-center gap-2 rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-white"
              >
                <Blender className="h-4 w-4" strokeWidth={1.75} />
                Remix
              </Link>
            ) : null}
            {(isOwner || isAdmin) &&
            canOwnerEditSticker(sticker.moderationStatus) ? (
              <>
                <Link
                  href={`/stickers/${sticker.slug}/compose`}
                  className="inline-flex items-center rounded-full border border-divider bg-surface px-5 py-2.5 text-sm font-semibold hover:border-accent-pink/40"
                >
                  Edit composition
                </Link>
                <Link
                  href={`/stickers/${sticker.slug}/edit`}
                  className="inline-flex items-center rounded-full border border-divider bg-surface px-5 py-2.5 text-sm font-semibold hover:border-accent-pink/40"
                >
                  Edit metadata
                </Link>
              </>
            ) : null}
            {(isOwner || isAdmin) &&
            !canOwnerEditSticker(sticker.moderationStatus) ? (
              <p className="w-full text-xs text-secondary">
                Waiting for review — editing unlocks after approval or when an
                admin requests changes.
              </p>
            ) : null}
          </div>

          <AttributionClaimForm
            stickerId={sticker.id.toString()}
            signedIn={viewerId != null}
            signInHref={signInUrl({ redirectTo: `/stickers/${sticker.slug}` })}
            defaults={contactDefaults}
            initialBlobber={claimBlobber}
            alreadyPending={!!pendingClaim}
          />

          <p className="mt-4 text-xs text-inactive">
            Popularity {sticker.popularityScore.toString()} ·{" "}
            {sticker.likesCount.toString()} likes ·{" "}
            {sticker.collectionMembershipCount.toString()} collections ·{" "}
            {sticker.printMembershipCount.toString()} prints
          </p>
        </div>
      </div>

      {relatedCards.length > 0 ? (
        <div className="mt-16">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-accent-pink">
            related
          </p>
          <h2 className="zune-header mt-1 text-3xl font-light lowercase tracking-tight">
            more like this
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 sm:gap-5">
            {relatedCards.map((item) => (
              <StickerCard
                key={item.stickerId ?? item.href}
                {...item}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
