import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Blender } from "lucide-react";
import { AddToCollectionButton } from "@/components/add-to-collection-button";
import { AttributionClaimForm } from "@/components/attribution-claim-form";
import { AttributionCredit } from "@/components/attribution-credit";
import { FavouriteButton } from "@/components/favourite-button";
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
import {
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
  PROCESSING_STATUS,
  VISIBILITY,
  canAccessSticker,
  canOwnerEditSticker,
  isPublicBrowseable,
} from "@/lib/stickers";

function typeFromMedia(kinds: string[]): string {
  if (kinds.includes(MEDIA_KIND.video)) return "VIDEO";
  if (kinds.includes(MEDIA_KIND.gif)) return "GIF";
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

  const type = typeFromMedia(sticker.media.map((m) => m.kind));
  const mediaKind =
    type === "VIDEO"
      ? MEDIA_KIND.video
      : type === "GIF"
        ? MEDIA_KIND.gif
        : MEDIA_KIND.image;
  const hasKind = sticker.media.some(
    (m) => m.kind === mediaKind && m.status === MEDIA_ASSET_STATUS.ready,
  );
  const displayKind = hasKind ? mediaKind : MEDIA_KIND.thumbnail;

  const creditLabel =
    sticker.authorName ||
    sticker.createdBy.displayName ||
    sticker.createdBy.username;

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
          <div className="mt-2">
            <AttributionCredit
              label={creditLabel}
              sourceUrl={sticker.sourceUrl}
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
            alreadyPending={!!pendingClaim}
          />
        </div>
      </div>
    </section>
  );
}
