import { describe, expect, it } from "vitest";
import { SEARCH_META_STATUS } from "../lib/search/constants";
import { MEILI_EMBEDDER, MEILI_INDEX } from "../lib/meili/indexes";
import { JOB_TYPE, JOB_TYPES } from "../lib/jobs/types";
import { isMeiliConfigured } from "../lib/meili/client";

describe("search constants", () => {
  it("exposes search meta statuses", () => {
    expect(SEARCH_META_STATUS.pendingSearchMeta).toBe("pending_search_meta");
    expect(SEARCH_META_STATUS.approved).toBe("approved");
  });

  it("registers search_enrich job type", () => {
    expect(JOB_TYPE.searchEnrich).toBe("search_enrich");
    expect(JOB_TYPES).toContain("search_enrich");
  });

  it("names meili indexes and embedders", () => {
    expect(MEILI_INDEX.stickers).toBe("stickers");
    expect(MEILI_EMBEDDER.image).toBe("image");
  });

  it("treats empty MEILI_HOST as unconfigured", () => {
    const prev = process.env.MEILI_HOST;
    delete process.env.MEILI_HOST;
    expect(isMeiliConfigured()).toBe(false);
    if (prev !== undefined) process.env.MEILI_HOST = prev;
  });
});
