import { notFound } from "next/navigation";
import { BlobberProfileView } from "@/components/blobber-profile-view";
import { prisma } from "@/lib/prisma";

/** Permanent Blobber profile — survives display-name / slug changes. */
export default async function BlobberIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let blobberId: bigint;
  try {
    blobberId = BigInt(id);
  } catch {
    notFound();
  }

  const blobber = await prisma.blobber.findUnique({
    where: { id: blobberId },
    include: {
      user: { select: { username: true } },
      socialLinks: { include: { socialLink: true } },
    },
  });
  if (!blobber) notFound();

  return <BlobberProfileView blobber={blobber} />;
}
