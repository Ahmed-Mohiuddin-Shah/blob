import { AttributionClaimsList } from "@/components/attribution-claims-list";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-user";

export default async function ProfileClaimsPage() {
  await requireAdmin();

  const claims = await prisma.attributionClaim.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      claimant: { select: { username: true, displayName: true } },
      sticker: { select: { id: true, title: true, slug: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Attribution claims</h1>
      <p className="mt-1 text-sm text-secondary">
        Approve applies the proposed credit to the sticker. Note required either way.
      </p>
      <div className="mt-8">
        <AttributionClaimsList
          items={claims.map((c) => ({
            id: c.id.toString(),
            reason: c.reason,
            status: c.status,
            contactName: c.contactName,
            contactEmail: c.contactEmail,
            message: c.message,
            proposedAuthorName: c.proposedAuthorName,
            proposedSourceUrl: c.proposedSourceUrl,
            createdAt: c.createdAt.toISOString(),
            sticker: {
              id: c.sticker.id.toString(),
              title: c.sticker.title,
              slug: c.sticker.slug,
              thumbUrl: `/api/stickers/${c.sticker.id}/media/thumbnail`,
            },
            claimant: c.claimant,
          }))}
        />
      </div>
    </div>
  );
}
