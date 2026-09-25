import { describe, expect, it } from "vitest";
import { createFromSource, remixDeepCopy, validateDocument } from "blob-editor/core";
import { primaryAssetIdFromDocument } from "@/lib/composition";
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
  it("allows approved and needs_edit only", () => {
    expect(canOwnerEditSticker("approved")).toBe(true);
    expect(canOwnerEditSticker("needs_edit")).toBe(true);
    expect(canOwnerEditSticker("pending_review")).toBe(false);
    expect(canOwnerEditSticker("draft")).toBe(false);
  });
});
