import { LogsAdminOps } from "@/components/logs-admin-ops";
import { ProcessingLogsList } from "@/components/processing-logs-list";
import {
  countMissingSearchMeta,
  countMissingWhatsAppOg,
} from "@/app/actions/admin-logs-ops";
import { requireSuperadmin } from "@/lib/require-user";

export default async function ProfileLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSuperadmin();
  const { q } = await searchParams;
  const [missingOgCount, missingSearchMetaCount] = await Promise.all([
    countMissingWhatsAppOg(),
    countMissingSearchMeta(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Processing logs</h1>
      <p className="mt-1 text-sm text-secondary">
        Encode, enrich, and Meili failures. Bulk ops below require confirmation —
        they can hog workers, Glass, AI, and Meili.
      </p>
      <div className="mt-6">
        <LogsAdminOps
          missingOgCount={missingOgCount}
          missingSearchMetaCount={missingSearchMetaCount}
        />
      </div>
      <div className="mt-8">
        <ProcessingLogsList initialQ={q ?? ""} />
      </div>
    </div>
  );
}
