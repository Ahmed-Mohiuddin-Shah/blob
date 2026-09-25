import { describe, expect, it } from "vitest";
import { mergePackSheetIds } from "@/lib/prints";

describe("mergePackSheetIds", () => {
  it("merges direct sheets and pack sheets, deduping", () => {
    const ids = mergePackSheetIds({
      sheetIds: [BigInt(1), BigInt(2)],
      packs: [{ id: BigInt(10), sheetIds: [BigInt(2), BigInt(3)] }],
    });
    expect(ids.map(String)).toEqual(["1", "2", "3"]);
  });

  it("excludes the linked pack so it is not nested into itself", () => {
    const ids = mergePackSheetIds({
      sheetIds: [BigInt(1)],
      packs: [
        { id: BigInt(99), sheetIds: [BigInt(1), BigInt(2)] },
        { id: BigInt(11), sheetIds: [BigInt(3)] },
      ],
      excludePackId: BigInt(99),
    });
    expect(ids.map(String)).toEqual(["1", "3"]);
  });
});
