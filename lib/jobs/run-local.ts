import { processCompositionEncode } from "@/lib/composition-encode";
import { JOB_TYPE, type JobType } from "@/lib/jobs/types";
import { processPackEncode, processSheetEncode } from "@/lib/print-encode";
import { processSearchEnrichLocal } from "@/lib/search/enrich";

/** Run encode / enrich cores in-process (local fallback only). */
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
  await processPackEncode(subjectId);
}
