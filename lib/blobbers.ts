import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isHttpUrl } from "@/lib/attribution";
import { slugify } from "@/lib/stickers";

export const SOCIAL_LINK_TYPES = [
  "youtube",
  "instagram",
  "internet",
  "merch",
  "other",
] as const;
export type SocialLinkType = (typeof SOCIAL_LINK_TYPES)[number];

export const BLOBBER_REQUEST_STATUS = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  needsEdit: "needs_edit",
} as const;

export type BlobberCmsPayload = {
  displayName: string;
  description: string | null;
  bannerGlassObjectId: string | null;
  avatarGlassObjectId: string | null;
  showStickers: boolean;
  showCollections: boolean;
  showStickerSheets: boolean;
  socialLinks: Array<{
    linkType: SocialLinkType;
    handle: string;
    url: string;
  }>;
};

export function normalizeBlobberName(name: string): string {
  return name.trim().slice(0, 200);
}

/** Stored unique key for CI display_name lookups (Prisma findUnique). */
export function blobberDisplayNameKey(name: string): string {
  return normalizeBlobberName(name).toLowerCase();
}

/** Pretty public profile path. */
export function blobberPublicHref(blobber: { slug: string }): string {
  return `/blobbers/${blobber.slug}`;
}

/** Permanent profile path (survives display-name / slug changes). */
export function blobberPermalinkHref(blobber: {
  id: bigint | string | number;
}): string {
  return `/blobbers/id/${blobber.id}`;
}

/** Reserved path segment under /blobbers/ — never allocate as a slug. */
const RESERVED_SLUGS = new Set(["id", "preview"]);

export function blobberSlugFromName(displayName: string): string {
  const base = slugify(displayName, 200);
  if (!base || RESERVED_SLUGS.has(base)) return "blobber";
  return base;
}

/** Unique slug from display name; keep current slug if still a valid candidate. */
export async function allocateBlobberSlug(
  displayName: string,
  opts?: {
    excludeId?: bigint;
    preferSlug?: string | null;
    tx?: Prisma.TransactionClient | typeof prisma;
  },
): Promise<string> {
  const tx = opts?.tx ?? prisma;
  const base = blobberSlugFromName(displayName);
  const prefer = opts?.preferSlug?.trim() || null;
  if (
    prefer &&
    !RESERVED_SLUGS.has(prefer) &&
    (prefer === base || prefer.startsWith(`${base}-`))
  ) {
    const existing = await tx.blobber.findUnique({
      where: { slug: prefer },
      select: { id: true },
    });
    if (
      !existing ||
      (opts?.excludeId != null && existing.id === opts.excludeId)
    ) {
      return prefer;
    }
  }

  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const existing = await tx.blobber.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (
      !existing ||
      (opts?.excludeId != null && existing.id === opts.excludeId)
    ) {
      return candidate;
    }
  }
  return `${base}-${Date.now()}`;
}

/** Case-insensitive find by display name. */
export async function findBlobberByName(
  displayName: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const name = normalizeBlobberName(displayName);
  if (!name) return null;
  return tx.blobber.findUnique({
    where: { displayNameKey: blobberDisplayNameKey(name) },
  });
}

/**
 * Find-or-create unlinked Blobber by unique CI name.
 * Never creates a duplicate — races re-select the winner.
 */
export async function resolveUnlinkedBlobber(
  displayName: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const name = normalizeBlobberName(displayName);
  if (!name) throw new Error("Blobber name required");

  const existing = await findBlobberByName(name, tx);
  if (existing) return existing;

  try {
    return await tx.blobber.create({
      data: {
        displayName: name,
        displayNameKey: blobberDisplayNameKey(name),
        userId: null,
        slug: await allocateBlobberSlug(name, { tx }),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const again = await findBlobberByName(name, tx);
      if (again) return again;
    }
    throw err;
  }
}

async function uniqueLinkedDisplayName(
  preferred: string,
  username: string,
  tx: Prisma.TransactionClient | typeof prisma,
): Promise<string> {
  const base = normalizeBlobberName(preferred) || username;
  if (!(await findBlobberByName(base, tx))) return base;
  const withUser = normalizeBlobberName(`${base} (${username})`);
  if (!(await findBlobberByName(withUser, tx))) return withUser;
  for (let i = 2; i < 100; i++) {
    const candidate = normalizeBlobberName(`${base} (${username}${i})`);
    if (!(await findBlobberByName(candidate, tx))) return candidate;
  }
  return normalizeBlobberName(`${base} (${username}-${Date.now()})`);
}

/** Lazy ensure one linked Blobber per user. */
export async function ensureLinkedBlobber(
  userId: bigint,
  opts?: { displayName?: string; username?: string },
) {
  const existing = await prisma.blobber.findUnique({ where: { userId } });
  if (existing) return existing;

  const user =
    opts?.displayName && opts?.username
      ? { displayName: opts.displayName, username: opts.username }
      : await prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { displayName: true, username: true },
        });

  const displayName = await uniqueLinkedDisplayName(
    opts?.displayName ?? user.displayName,
    opts?.username ?? user.username,
    prisma,
  );

  try {
    return await prisma.blobber.create({
      data: {
        userId,
        displayName,
        displayNameKey: blobberDisplayNameKey(displayName),
        slug: await allocateBlobberSlug(displayName),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const again = await prisma.blobber.findUnique({ where: { userId } });
      if (again) return again;
    }
    throw err;
  }
}

export type AttributionMode = "self" | "none" | "other";

/**
 * Parse sticker attribution form fields into blobberId + sourceUrl.
 * mode: self (own linked blobber, no source) | none (null) | other (pick/create + optional source)
 */
export async function parseBlobberAttributionInput(input: {
  mode: string;
  blobberId?: string;
  blobberDisplayName?: string;
  sourceUrl?: string;
  userId: bigint;
  userDisplayName?: string;
  username?: string;
}): Promise<{ blobberId: bigint | null; sourceUrl: string | null } | { error: string }> {
  const mode = input.mode.trim().toLowerCase() as AttributionMode;
  if (mode !== "self" && mode !== "none" && mode !== "other") {
    return { error: "Attribution mode must be self, none, or other" };
  }

  if (mode === "none") {
    return { blobberId: null, sourceUrl: null };
  }

  if (mode === "self") {
    const linked = await ensureLinkedBlobber(input.userId, {
      displayName: input.userDisplayName,
      username: input.username,
    });
    return { blobberId: linked.id, sourceUrl: null };
  }

  // other
  const idRaw = (input.blobberId ?? "").trim();
  const nameRaw = normalizeBlobberName(input.blobberDisplayName ?? "");
  let blobberId: bigint | null = null;

  if (idRaw) {
    const found = await prisma.blobber.findUnique({
      where: { id: BigInt(idRaw) },
    });
    if (!found) return { error: "Blobber not found" };
    blobberId = found.id;
  } else if (nameRaw) {
    const resolved = await resolveUnlinkedBlobber(nameRaw);
    blobberId = resolved.id;
  } else {
    return { error: "Select or create a Blobber" };
  }

  const sourceRaw = (input.sourceUrl ?? "").trim().slice(0, 2048);
  if (sourceRaw && !isHttpUrl(sourceRaw)) {
    return { error: "Source link must be an http(s) URL" };
  }
  return { blobberId, sourceUrl: sourceRaw || null };
}

export function parseCmsPayload(raw: unknown): BlobberCmsPayload | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Invalid payload" };
  const o = raw as Record<string, unknown>;
  const displayName = normalizeBlobberName(
    typeof o.displayName === "string" ? o.displayName : "",
  );
  if (!displayName) return { error: "Display name required" };

  const description =
    typeof o.description === "string"
      ? o.description.trim().slice(0, 4000) || null
      : null;
  const bannerGlassObjectId =
    typeof o.bannerGlassObjectId === "string" && o.bannerGlassObjectId
      ? o.bannerGlassObjectId
      : null;
  const avatarGlassObjectId =
    typeof o.avatarGlassObjectId === "string" && o.avatarGlassObjectId
      ? o.avatarGlassObjectId
      : null;

  const socialRaw = Array.isArray(o.socialLinks) ? o.socialLinks : [];
  const socialLinks: BlobberCmsPayload["socialLinks"] = [];
  for (const item of socialRaw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const linkType = typeof s.linkType === "string" ? s.linkType : "";
    if (!SOCIAL_LINK_TYPES.includes(linkType as SocialLinkType)) {
      return { error: "Invalid social link type" };
    }
    const handle = (typeof s.handle === "string" ? s.handle : "").trim().slice(0, 200);
    const url = (typeof s.url === "string" ? s.url : "").trim().slice(0, 2048);
    if (!handle || !isHttpUrl(url)) {
      return { error: "Each social link needs a handle and http(s) URL" };
    }
    socialLinks.push({
      linkType: linkType as SocialLinkType,
      handle,
      url,
    });
  }

  return {
    displayName,
    description,
    bannerGlassObjectId,
    avatarGlassObjectId,
    showStickers: o.showStickers !== false,
    showCollections: o.showCollections !== false,
    showStickerSheets: o.showStickerSheets !== false,
    socialLinks,
  };
}

export async function applyCmsPayload(
  blobberId: bigint,
  payload: BlobberCmsPayload,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const clash = await findBlobberByName(payload.displayName, tx);
  if (clash && clash.id !== blobberId) {
    throw new Error("Display name already taken");
  }

  const current = await tx.blobber.findUnique({
    where: { id: blobberId },
    select: { slug: true },
  });
  const slug = await allocateBlobberSlug(payload.displayName, {
    excludeId: blobberId,
    preferSlug: current?.slug,
    tx,
  });

  await tx.blobber.update({
    where: { id: blobberId },
    data: {
      displayName: payload.displayName,
      displayNameKey: blobberDisplayNameKey(payload.displayName),
      slug,
      description: payload.description,
      bannerGlassObjectId: payload.bannerGlassObjectId,
      avatarGlassObjectId: payload.avatarGlassObjectId,
      showStickers: payload.showStickers,
      showCollections: payload.showCollections,
      showStickerSheets: payload.showStickerSheets,
    },
  });

  await tx.blobberSocialLink.deleteMany({ where: { blobberId } });
  for (const link of payload.socialLinks) {
    const created = await tx.socialLink.create({
      data: {
        linkType: link.linkType,
        handle: link.handle,
        url: link.url,
      },
    });
    await tx.blobberSocialLink.create({
      data: { blobberId, socialLinkId: created.id },
    });
  }
}

/** Move user_id onto target; re-point stickers from old linked blobber; keep old row. */
export async function approveAssociation(
  requesterId: bigint,
  targetBlobberId: bigint,
) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.blobber.findUnique({
      where: { id: targetBlobberId },
    });
    if (!target) throw new Error("Blobber not found");
    if (target.userId != null && target.userId !== requesterId) {
      throw new Error("Blobber already linked to another account");
    }

    const old = await tx.blobber.findUnique({ where: { userId: requesterId } });

    if (old && old.id === target.id) {
      return { oldId: old.id, targetId: target.id };
    }

    if (old) {
      await tx.blobber.update({
        where: { id: old.id },
        data: { userId: null },
      });
    }

    await tx.blobber.update({
      where: { id: target.id },
      data: { userId: requesterId },
    });

    if (old) {
      await tx.sticker.updateMany({
        where: { blobberId: old.id },
        data: { blobberId: target.id },
      });
    }

    return { oldId: old?.id ?? null, targetId: target.id };
  });
}

export function liveCmsSnapshot(blobber: {
  displayName: string;
  description: string | null;
  bannerGlassObjectId: string | null;
  avatarGlassObjectId: string | null;
  showStickers: boolean;
  showCollections: boolean;
  showStickerSheets: boolean;
  socialLinks: Array<{
    socialLink: { linkType: string; handle: string; url: string };
  }>;
}): BlobberCmsPayload {
  return {
    displayName: blobber.displayName,
    description: blobber.description,
    bannerGlassObjectId: blobber.bannerGlassObjectId,
    avatarGlassObjectId: blobber.avatarGlassObjectId,
    showStickers: blobber.showStickers,
    showCollections: blobber.showCollections,
    showStickerSheets: blobber.showStickerSheets,
    socialLinks: blobber.socialLinks.map((j) => ({
      linkType: j.socialLink.linkType as SocialLinkType,
      handle: j.socialLink.handle,
      url: j.socialLink.url,
    })),
  };
}
