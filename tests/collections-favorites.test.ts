import { describe, expect, it } from "vitest";
import {
  MAX_COLLECTION_ITEMS,
  MIN_COLLECTION_ITEMS,
  parseCollectionItemType,
  COLLECTION_ITEM,
  isInUserCollection,
  subjectsInUserCollections,
  userCollectionIdsContaining,
} from "@/lib/collections";
import {
  FAVORITE_SUBJECT,
  parseFavoriteSubjectType,
  parseFavoriteUiType,
  bumpLikesCount,
  bumpStickerLikesCount,
} from "@/lib/favorites";
import {
  MAX_SHEET_STICKERS,
  MIN_PACK_SHEETS,
  MIN_SHEET_STICKERS,
  parsePrintFormat,
  PRINT_FORMAT,
  PRINT_STATUS,
  selectionHasNonPublic,
} from "@/lib/prints";

describe("collections + favourites locks", () => {
  it("caps collections at 1–60 items", () => {
    expect(MIN_COLLECTION_ITEMS).toBe(1);
    expect(MAX_COLLECTION_ITEMS).toBe(60);
  });

  it("parses collection item types", () => {
    expect(parseCollectionItemType(COLLECTION_ITEM.sticker)).toBe(
      COLLECTION_ITEM.sticker,
    );
    expect(parseCollectionItemType(COLLECTION_ITEM.stickerSheet)).toBe(
      COLLECTION_ITEM.stickerSheet,
    );
    expect(parseCollectionItemType(COLLECTION_ITEM.stickerPack)).toBe(
      COLLECTION_ITEM.stickerPack,
    );
    expect(parseCollectionItemType("nope")).toBeNull();
  });

  it("exports collection membership helpers", () => {
    expect(typeof isInUserCollection).toBe("function");
    expect(typeof subjectsInUserCollections).toBe("function");
    expect(typeof userCollectionIdsContaining).toBe("function");
  });

  it("parses favourite subject types including sheet/pack UI", () => {
    expect(parseFavoriteUiType(FAVORITE_SUBJECT.sticker)).toBe(
      FAVORITE_SUBJECT.sticker,
    );
    expect(parseFavoriteUiType(FAVORITE_SUBJECT.collection)).toBe(
      FAVORITE_SUBJECT.collection,
    );
    expect(parseFavoriteUiType(FAVORITE_SUBJECT.stickerSheet)).toBe(
      FAVORITE_SUBJECT.stickerSheet,
    );
    expect(parseFavoriteUiType(FAVORITE_SUBJECT.stickerPack)).toBe(
      FAVORITE_SUBJECT.stickerPack,
    );
    expect(parseFavoriteSubjectType(FAVORITE_SUBJECT.stickerPack)).toBe(
      FAVORITE_SUBJECT.stickerPack,
    );
    expect(parseFavoriteSubjectType("nope")).toBeNull();
  });

  it("exports likes_count bump helpers", () => {
    expect(typeof bumpStickerLikesCount).toBe("function");
    expect(typeof bumpLikesCount).toBe("function");
  });
});

describe("prints locks", () => {
  it("sheet sticker bounds and pack min sheets", () => {
    expect(MIN_SHEET_STICKERS).toBe(1);
    expect(MAX_SHEET_STICKERS).toBe(20);
    expect(MIN_PACK_SHEETS).toBe(2);
  });

  it("print status and format enums", () => {
    expect(PRINT_STATUS.pending).toBe("pending");
    expect(PRINT_STATUS.ready).toBe("ready");
    expect(PRINT_STATUS.failed).toBe("failed");
    expect(parsePrintFormat("pdf")).toBe(PRINT_FORMAT.pdf);
    expect(parsePrintFormat("png")).toBe(PRINT_FORMAT.png);
    expect(parsePrintFormat("gif")).toBeNull();
  });

  it("flags non-public stickers for sheet disclaimer", () => {
    expect(
      selectionHasNonPublic([{ visibility: "public" }, { visibility: "public" }]),
    ).toBe(false);
    expect(
      selectionHasNonPublic([
        { visibility: "public" },
        { visibility: "private" },
      ]),
    ).toBe(true);
    expect(
      selectionHasNonPublic([{ visibility: "unlisted" }]),
    ).toBe(true);
  });
});
