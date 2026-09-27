import { ProcessingLogsList } from "@/components/processing-logs-list";
import { SearchReindexAdmin } from "@/components/search-reindex-admin";
import { requireSuperadmin } from "@/lib/require-user";

export default async function ProfileLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSuperadmin();
  const { q } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Processing logs</h1>
      <p className="mt-1 text-sm text-secondary">
        Encode, enrich, and Meili failures. Reindex pushes the existing catalog
        into search without AI enrich.
      </p>
      <div className="mt-6">
        <SearchReindexAdmin />
      </div>
      <div className="mt-8">
        <ProcessingLogsList initialQ={q ?? ""} />
      </div>
    </div>
  );
}
