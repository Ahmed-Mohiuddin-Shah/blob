import { describe, expect, it } from "vitest";
import { createFromSource, remixDeepCopy, validateDocument } from "blob-editor/core";
import { primaryAssetIdFromDocument } from "@/lib/composition";
import { MODERATION_STATUS } from "@/lib/moderation";
import { canOwnerEditSticker } from "@/lib/stickers";

describe("blob-editor document contract", () => {
  it("createFromSource + remixDeepCopy keep shared asset ids", () => {
    const doc = validateDocument(createFromSource("42", 800, 600));
    expect(doc.version).toBe(2);
    expect(doc.canvas.width).toBe(1024);
    const remixed = remixDeepCopy(doc);
    expect(remixed.objects).not.toBe(doc.objects);
    const media = remixed.objects.find((o) => o.type === "media");
    expect(media && media.type === "media" && media.asset_id).toBe("42");
  });

  it("primaryAssetIdFromDocument reads first media asset_id", () => {
    const doc = validateDocument(createFromSource("99", 100, 100));
    expect(primaryAssetIdFromDocument(doc)).toBe("99");
  });
});

describe("canOwnerEditSticker", () => {
  it("allows approved and needs_edit only (no role bypass — status gate for everyone)", () => {
    expect(canOwnerEditSticker(MODERATION_STATUS.approved)).toBe(true);
    expect(canOwnerEditSticker(MODERATION_STATUS.needsEdit)).toBe(true);
    expect(canOwnerEditSticker(MODERATION_STATUS.pendingReview)).toBe(false);
    expect(canOwnerEditSticker(MODERATION_STATUS.draft)).toBe(false);
    expect(canOwnerEditSticker(MODERATION_STATUS.rejected)).toBe(false);
  });
});
