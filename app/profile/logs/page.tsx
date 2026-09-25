import { ProcessingLogsList } from "@/components/processing-logs-list";
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
        Encode and process failures for stickers, sheets, and packs.
      </p>
      <div className="mt-8">
        <ProcessingLogsList initialQ={q ?? ""} />
      </div>
    </div>
  );
}
