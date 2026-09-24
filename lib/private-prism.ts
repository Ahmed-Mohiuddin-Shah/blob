import { getGlass } from "@/lib/glass";
import { prisma } from "@/lib/prisma";

/** Ensure user has a private GLASS prism; returns its UUID. */
export async function ensurePrivatePrism(
  userId: bigint,
  existing: string | null,
): Promise<string> {
  if (existing) return existing;
  const glass = getGlass();
  const prism = await glass.prisms.create({
    label: `blob-user-${userId}`,
    is_public: false,
  });
  await prisma.user.update({
    where: { id: userId },
    data: { glassPrivatePrismId: prism.id },
  });
  return prism.id;
}
