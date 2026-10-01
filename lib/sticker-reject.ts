import { GlassError } from "glass-ts";
import { enqueueCompositionEncode } from "@/lib/composition-encode";
import { getGlass } from "@/lib/glass";
import { prisma } from "@/lib/prisma";
import { MEDIA_KIND, PROCESSING_STATUS } from "@/lib/stickers";
import { MODERATION_STATUS } from "@/lib/moderation";

async function deleteGlassObject(objectId: string, prismId: string) {
  const glass = getGlass();
  try {
    await glass.prisms.unlinkObject(prismId, objectId);
  } catch {
    /* best-effort */
  }
  try {
    await glass.objects.delete(objectId);
  } catch (err) {
    if (err instanceof GlassError && err.status === 404) return;
    throw err;
  }
}

/** Hard purge sticker + all media objects (first-submit reject). */
export async function purgeSticker(stickerId: bigint): Promise<void> {
  const sticker = await prisma.sticker.findUnique({
    where: { id: stickerId },
    include: { media: true },
  });
  if (!sticker) return;

  const objects = new Map<string, string>();
  for (const asset of sticker.media) {
    objects.set(asset.glassObjectId, asset.glassPrismId);
  }
  for (const [objectId, prismId] of objects) {
    await deleteGlassObject(objectId, prismId);
  }
  await prisma.sticker.delete({ where: { id: stickerId } });
}

/**
 * Reject an edit of a previously published sticker: restore prior revision,
 * drop rejected stills, re-encode. Does not delete the sticker row.
 */
export async function restoreStickerAfterRejectedEdit(
  stickerId: bigint,
): Promise<void> {
  const sticker = await prisma.sticker.findUnique({
    where: { id: stickerId },
    include: {
      media: true,
      composition: {
        include: {
          revisions: { orderBy: { revision: "desc" } },
        },
      },
    },
  });
  if (!sticker?.composition) {
    throw new Error("Missing composition");
  }
  const revisions = sticker.composition.revisions;
  if (revisions.length < 2) {
    throw new Error("No prior revision to restore");
  }

  const prevThumb = sticker.media.find((m) => m.kind === MEDIA_KIND.prevThumbnail);
  const restoreRev =
    (prevThumb?.compositionRevisionId
      ? revisions.find((r) => r.id === prevThumb.compositionRevisionId)
      : null) ?? revisions[1];
  if (!restoreRev) {
    throw new Error("No prior revision to restore");
  }

  const rejectedRevIds = revisions
    .filter((r) => r.revision > restoreRev.revision)
    .map((r) => r.id);
  if (rejectedRevIds.length === 0) {
    throw new Error("No rejected revision to discard");
  }

  // Drop stills written for the rejected revision(s).
  const rejectedMedia = sticker.media.filter(
    (m) =>
      m.compositionRevisionId != null &&
      rejectedRevIds.some((id) => id === m.compositionRevisionId),
  );
  const keepIds = new Set(
    sticker.media
      .filter(
        (m) =>
          m.compositionRevisionId === restoreRev.id ||
          m.kind === MEDIA_KIND.prevThumbnail,
      )
      .map((m) => m.glassObjectId),
  );
  for (const asset of rejectedMedia) {
    if (!keepIds.has(asset.glassObjectId)) {
      await deleteGlassObject(asset.glassObjectId, asset.glassPrismId);
    }
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
  }

  // Restore prior thumbnail from prev_thumbnail slot.
  const freshPrev = await prisma.mediaAsset.findUnique({
    where: {
      stickerId_kind: { stickerId, kind: MEDIA_KIND.prevThumbnail },
    },
  });
  if (freshPrev) {
    const existingThumb = await prisma.mediaAsset.findUnique({
      where: { stickerId_kind: { stickerId, kind: MEDIA_KIND.thumbnail } },
    });
    if (existingThumb) {
      if (!keepIds.has(existingThumb.glassObjectId)) {
        await deleteGlassObject(
          existingThumb.glassObjectId,
          existingThumb.glassPrismId,
        );
      }
      await prisma.mediaAsset.delete({ where: { id: existingThumb.id } });
    }
    await prisma.mediaAsset.update({
      where: { id: freshPrev.id },
      data: {
        kind: MEDIA_KIND.thumbnail,
        compositionRevisionId: restoreRev.id,
      },
    });
  }

  await prisma.composition.update({
    where: { id: sticker.composition.id },
    data: { currentRevisionId: restoreRev.id },
  });

  await prisma.compositionRevision.deleteMany({
    where: { id: { in: rejectedRevIds } },
  });

  await prisma.sticker.update({
    where: { id: stickerId },
    data: {
      moderationStatus: MODERATION_STATUS.approved,
      moderationNote: null,
      processingStatus: PROCESSING_STATUS.processing,
      processingError: null,
    },
  });

  enqueueCompositionEncode(stickerId);
}
