import { BlobberCmsForm } from "@/components/blobber-cms-form";
import {
  ensureLinkedBlobber,
  liveCmsSnapshot,
  parseCmsPayload,
  type BlobberCmsPayload,
} from "@/lib/blobbers";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/require-user";
import Link from "next/link";

export default async function ProfileBlobberPage() {
  const { user } = await requireSessionUser();
  const blobber = await ensureLinkedBlobber(user.id, {
    displayName: user.displayName,
    username: user.username,
  });

  const full = await prisma.blobber.findUniqueOrThrow({
    where: { id: blobber.id },
    include: { socialLinks: { include: { socialLink: true } } },
  });

  const pending = await prisma.blobberEditRequest.findFirst({
    where: {
      blobberId: blobber.id,
      status: { in: ["pending", "needs_edit"] },
    },
    orderBy: { createdAt: "desc" },
  });

  let initialProposed: BlobberCmsPayload | null = null;
  if (pending) {
    const parsed = parseCmsPayload(pending.proposedPayload);
    if (!("error" in parsed)) initialProposed = parsed;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blobber profile</h1>
          <p className="mt-1 text-sm text-secondary">
            Public CMS for your credit identity. Private BLOB account stays separate.
          </p>
        </div>
        <Link
          href="/profile/blobber/associate"
          className="text-sm font-semibold text-accent-pink hover:underline"
        >
          Request association →
        </Link>
      </div>
      <div className="mt-8">
        <BlobberCmsForm
          blobberId={full.id.toString()}
          slug={full.slug}
          live={liveCmsSnapshot(full)}
          pendingStatus={pending?.status ?? null}
          adminNote={pending?.adminNote ?? null}
          initialProposed={initialProposed}
        />
      </div>
    </div>
  );
}
