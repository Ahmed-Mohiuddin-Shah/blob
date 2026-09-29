import { processCompositionEncode } from "@/lib/composition-encode";
import { JOB_TYPE, type JobType } from "@/lib/jobs/types";
import { processPackEncode, processSheetEncode } from "@/lib/print-encode";
import { processSearchEnrichLocal } from "@/lib/search/enrich";
import { reindexCatalogSearch } from "@/lib/search/reindex";

/** Run encode / enrich / catalog reindex cores in-process (local fallback only). */
export async function runLocalJob(
  type: JobType,
  subjectId: bigint,
): Promise<void> {
  if (type === JOB_TYPE.compositionEncode) {
    await processCompositionEncode(subjectId);
    return;
  }
  if (type === JOB_TYPE.sheetEncode) {
    await processSheetEncode(subjectId);
    return;
  }
  if (type === JOB_TYPE.searchEnrich) {
    await processSearchEnrichLocal(subjectId);
    return;
  }
  if (type === JOB_TYPE.catalogReindex) {
    await reindexCatalogSearch();
    return;
  }
  await processPackEncode(subjectId);
}
