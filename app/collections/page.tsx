import { CollectionsLibrary } from "@/components/collections-library";

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  return <CollectionsLibrary initialQ={sp.q ?? ""} />;
}
