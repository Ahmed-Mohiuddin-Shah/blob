import { describe, expect, it } from "vitest";
import {
  MAX_COLLECTION_STICKERS,
  MIN_COLLECTION_STICKERS,
} from "@/lib/collections";
import {
  parseFavoriteSubjectType,
  parseFavoriteUiType,
} from "@/lib/favorites";

describe("collections + favourites locks", () => {
  it("caps collections at 1–60 stickers", () => {
    expect(MIN_COLLECTION_STICKERS).toBe(1);
    expect(MAX_COLLECTION_STICKERS).toBe(60);
  });

  it("parses favourite subject types", () => {
    expect(parseFavoriteUiType("sticker")).toBe("sticker");
    expect(parseFavoriteUiType("collection")).toBe("collection");
    expect(parseFavoriteUiType("sticker_sheet")).toBeNull();
    expect(parseFavoriteSubjectType("sticker_pack")).toBe("sticker_pack");
    expect(parseFavoriteSubjectType("nope")).toBeNull();
  });
});
