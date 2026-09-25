import { describe, expect, it } from "vitest";
import { packSheetsHash } from "@/lib/prints";

describe("packSheetsHash", () => {
  it("is order-insensitive for the same sheet set", () => {
    const a = packSheetsHash([BigInt(3), BigInt(1), BigInt(2)]);
    const b = packSheetsHash([BigInt(1), BigInt(2), BigInt(3)]);
    const c = packSheetsHash([BigInt(2), BigInt(3), BigInt(1)]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differs for different sheet sets", () => {
    const a = packSheetsHash([BigInt(1), BigInt(2)]);
    const b = packSheetsHash([BigInt(1), BigInt(3)]);
    expect(a).not.toBe(b);
  });
});
