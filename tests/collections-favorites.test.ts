import { describe, expect, it } from "vitest";
import {
  MAX_COLLECTION_STICKERS,
  MIN_COLLECTION_STICKERS,
} from "@/lib/collections";
import {
  FAVORITE_SUBJECT,
  parseFavoriteSubjectType,
  parseFavoriteUiType,
} from "@/lib/favorites";

describe("collections + favourites locks", () => {
  it("caps collections at 1–60 stickers", () => {
    expect(MIN_COLLECTION_STICKERS).toBe(1);
    expect(MAX_COLLECTION_STICKERS).toBe(60);
  });

  it("parses favourite subject types", () => {
    expect(parseFavoriteUiType(FAVORITE_SUBJECT.sticker)).toBe(
      FAVORITE_SUBJECT.sticker,
    );
    expect(parseFavoriteUiType(FAVORITE_SUBJECT.collection)).toBe(
      FAVORITE_SUBJECT.collection,
    );
    expect(parseFavoriteUiType(FAVORITE_SUBJECT.stickerSheet)).toBeNull();
    expect(parseFavoriteSubjectType(FAVORITE_SUBJECT.stickerPack)).toBe(
      FAVORITE_SUBJECT.stickerPack,
    );
    expect(parseFavoriteSubjectType("nope")).toBeNull();
  });
});
