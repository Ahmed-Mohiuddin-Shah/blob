import { describe, expect, it } from "vitest";
import { createFromSource, remixDeepCopy, validateDocument } from "blob-editor/core";

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
});
