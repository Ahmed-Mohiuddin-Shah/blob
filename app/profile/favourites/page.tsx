import { FavouritesLibrary } from "@/components/favourites-library";
import { requireSessionUser } from "@/lib/require-user";

export default async function ProfileFavouritesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSessionUser();
  const sp = await searchParams;
  return <FavouritesLibrary initialQ={sp.q ?? ""} />;
}
