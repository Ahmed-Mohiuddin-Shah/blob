import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const create = vi.fn();
const prismsCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    publicPrism: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

vi.mock("glass-ts", () => ({
  Glass: class {
    prisms = { create: (...args: unknown[]) => prismsCreate(...args) };
  },
}));

describe("getPublicPrismId", () => {
  beforeEach(() => {
    vi.resetModules();
    findUnique.mockReset();
    create.mockReset();
    prismsCreate.mockReset();
    process.env.GLASS_API_URL = "http://glass.test";
    process.env.GLASS_API_KEY = "k";
  });

  it("returns and caches existing public_prism row", async () => {
    findUnique.mockResolvedValue({
      glassPrismId: "11111111-1111-1111-1111-111111111111",
    });
    const { getPublicPrismId, clearPublicPrismCache } = await import(
      "@/lib/glass"
    );
    clearPublicPrismCache();
    const a = await getPublicPrismId();
    const b = await getPublicPrismId();
    expect(a).toBe("11111111-1111-1111-1111-111111111111");
    expect(b).toBe(a);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(prismsCreate).not.toHaveBeenCalled();
  });

  it("creates Glass prism and inserts public_prism when missing", async () => {
    findUnique.mockResolvedValueOnce(null);
    prismsCreate.mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
    });
    create.mockResolvedValue({});
    const { getPublicPrismId, clearPublicPrismCache } = await import(
      "@/lib/glass"
    );
    clearPublicPrismCache();
    const id = await getPublicPrismId();
    expect(id).toBe("22222222-2222-2222-2222-222222222222");
    expect(prismsCreate).toHaveBeenCalledWith({
      label: "blob-public",
      is_public: true,
    });
    expect(create).toHaveBeenCalled();
  });
});
