import { describe, expect, it } from "vitest";
import { isStickerEditor } from "@/lib/stickers";

describe("isStickerEditor", () => {
  const sticker = {
    uploadedById: BigInt(1),
    createdById: BigInt(2),
  };

  it("allows uploader and creator", () => {
    expect(isStickerEditor(sticker, BigInt(1), null)).toBe(true);
    expect(isStickerEditor(sticker, BigInt(2), null)).toBe(true);
  });

  it("allows credited linked blobber user", () => {
    expect(isStickerEditor(sticker, BigInt(9), BigInt(9))).toBe(true);
  });

  it("rejects strangers and mismatched blobber link", () => {
    expect(isStickerEditor(sticker, BigInt(9), null)).toBe(false);
    expect(isStickerEditor(sticker, BigInt(9), BigInt(8))).toBe(false);
  });
});
