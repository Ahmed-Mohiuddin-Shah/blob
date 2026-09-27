import { ensureMeiliIndexes } from "@/lib/meili/bootstrap";
import { getMeili, isMeiliConfigured } from "@/lib/meili/client";
import { MEILI_INDEX } from "@/lib/meili/indexes";
import { logMeiliError } from "@/lib/processing-log";
import {
  buildBlobberSearchDoc,
  buildCollectionSearchDoc,
  buildPrintSearchDoc,
  buildStickerSearchDoc,
} from "@/lib/search/documents";
import { prisma } from "@/lib/prisma";
async function ready(): Promise<ReturnType<typeof getMeili>> {
  if (!isMeiliConfigured()) return null;
  await ensureMeiliIndexes();
  return getMeili();
}

export async function upsertStickerSearch(
  stickerId: bigint,
  opts?: { requireSearchMeta?: boolean },
): Promise<void> {
  const meili = await ready();
  if (!meili) return;
  const doc = await buildStickerSearchDoc(stickerId, opts);
  if (!doc) {
    await meili.index(MEILI_INDEX.stickers).deleteDocument(stickerId.toString()).catch(() => {});
    return;
  }
  await meili.index(MEILI_INDEX.stickers).addDocuments([doc]);
  await prisma.sticker.update({
    where: { id: stickerId },
    data: { searchIndexedAt: new Date() },
  });
}

export async function deleteStickerSearch(stickerId: bigint): Promise<void> {
  const meili = await ready();
  if (!meili) return;
  await meili.index(MEILI_INDEX.stickers).deleteDocument(stickerId.toString()).catch(() => {});
}

export async function patchStickerPopularity(
  stickerId: bigint,
  attrs: {
    likesCount: number;
    collectionMembershipCount: number;
    printMembershipCount: number;
    popularityScore: number;
  },
): Promise<void> {
  const meili = await ready();
  if (!meili) return;
  const row = await prisma.sticker.findUnique({
    where: { id: stickerId },
    select: { searchIndexedAt: true },
  });
  if (!row?.searchIndexedAt) return;
  await meili.index(MEILI_INDEX.stickers).updateDocuments([
    { id: stickerId.toString(), ...attrs },
  ]);
}

export async function upsertCollectionSearch(collectionId: bigint): Promise<void> {
  const meili = await ready();
  if (!meili) return;
  const doc = await buildCollectionSearchDoc(collectionId);
  if (!doc) return;
  await meili.index(MEILI_INDEX.collections).addDocuments([doc]);
}

export async function upsertPrintSearch(
  kind: "sheet" | "pack",
  id: bigint,
): Promise<void> {
  const meili = await ready();
  if (!meili) return;
  const doc = await buildPrintSearchDoc(kind, id);
  if (!doc) {
    await meili
      .index(MEILI_INDEX.prints)
      .deleteDocument(`${kind}:${id}`)
      .catch(() => {});
    return;
  }
  await meili.index(MEILI_INDEX.prints).addDocuments([doc]);
}

export async function upsertBlobberSearch(blobberId: bigint): Promise<void> {
  const meili = await ready();
  if (!meili) return;
  const doc = await buildBlobberSearchDoc(blobberId);
  if (!doc) return;
  await meili.index(MEILI_INDEX.blobbers).addDocuments([doc]);
}

export function syncStickerSearch(stickerId: bigint): void {
  void upsertStickerSearch(stickerId).catch((err) => {
    console.error("upsertStickerSearch", stickerId.toString(), err);
    logMeiliError(`upsert sticker ${stickerId}`, err);
  });
}

export function syncCollectionSearch(collectionId: bigint): void {
  void upsertCollectionSearch(collectionId).catch((err) => {
    console.error("upsertCollectionSearch", collectionId.toString(), err);
    logMeiliError(`upsert collection ${collectionId}`, err);
  });
}

export function syncPrintSearch(kind: "sheet" | "pack", id: bigint): void {
  void upsertPrintSearch(kind, id).catch((err) => {
    console.error("upsertPrintSearch", kind, id.toString(), err);
    logMeiliError(`upsert print ${kind}:${id}`, err);
  });
}
