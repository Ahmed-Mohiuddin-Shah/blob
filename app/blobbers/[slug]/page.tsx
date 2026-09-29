import { notFound, permanentRedirect } from "next/navigation";
import { BlobberProfileView } from "@/components/blobber-profile-view";
import { prisma } from "@/lib/prisma";

/** Pretty Blobber profile by slug. Numeric params redirect to /blobbers/id/{id}. */
export default async function BlobberSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (/^\d+$/.test(slug)) {
    permanentRedirect(`/blobbers/id/${slug}`);
  }

  const blobber = await prisma.blobber.findUnique({
    where: { slug },
    include: {
      user: { select: { username: true } },
      socialLinks: { include: { socialLink: true } },
    },
  });
  if (!blobber) notFound();

  return <BlobberProfileView blobber={blobber} />;
}
