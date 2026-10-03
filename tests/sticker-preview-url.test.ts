import { describe, expect, it } from "vitest";
import {
  MEDIA_ASSET_STATUS,
  MEDIA_KIND,
  previewMediaKind,
  stickerPreviewUrl,
  whatsappOgImageKind,
} from "@/lib/stickers";
import {
  encodeWhatsAppOg,
  WHATSAPP_OG_MAX_BYTES,
  WHATSAPP_OG_SIZE,
} from "@/lib/whatsapp-og-encode";

const ready = (kind: string, mimeType?: string) => ({
  kind,
  status: MEDIA_ASSET_STATUS.ready,
  ...(mimeType != null ? { mimeType } : {}),
});

describe("stickerPreviewUrl", () => {
  it("uses thumbnail for VIDEO (GIF thumb after matrix encode)", () => {
    const url = stickerPreviewUrl(BigInt(42), [
      ready(MEDIA_KIND.thumbnail, "image/png"),
      ready(MEDIA_KIND.gif, "image/gif"),
      ready(MEDIA_KIND.video, "video/mp4"),
    ]);
    expect(url).toBe("/api/stickers/42/media/thumbnail");
  });

  it("skips video/mp4 thumbnail and uses gif", () => {
    const url = stickerPreviewUrl(BigInt(42), [
      ready(MEDIA_KIND.thumbnail, "video/mp4"),
      ready(MEDIA_KIND.chat, "video/mp4"),
      ready(MEDIA_KIND.image, "video/mp4"),
      ready(MEDIA_KIND.gif, "image/gif"),
      ready(MEDIA_KIND.video, "video/mp4"),
    ]);
    expect(url).toBe("/api/stickers/42/media/gif");
  });

  it("falls back to og when only mp4 slots and og exist", () => {
    const url = stickerPreviewUrl("9", [
      ready(MEDIA_KIND.thumbnail, "video/mp4"),
      ready(MEDIA_KIND.og, "image/jpeg"),
      ready(MEDIA_KIND.video, "video/mp4"),
    ]);
    expect(url).toBe("/api/stickers/9/media/og");
  });

  it("falls back to gif when thumbnail missing", () => {
    const url = stickerPreviewUrl("7", [
      ready(MEDIA_KIND.gif),
      ready(MEDIA_KIND.image),
    ]);
    expect(url).toBe("/api/stickers/7/media/gif");
  });

  it("falls back to chat before full image when thumbnail missing", () => {
    const url = stickerPreviewUrl("7", [
      ready(MEDIA_KIND.chat),
      ready(MEDIA_KIND.image),
    ]);
    expect(url).toBe("/api/stickers/7/media/chat");
  });
});

describe("previewMediaKind", () => {
  it("returns video for VIDEO stickers", () => {
    expect(
      previewMediaKind([
        ready(MEDIA_KIND.thumbnail),
        ready(MEDIA_KIND.gif),
        ready(MEDIA_KIND.video),
      ]),
    ).toBe(MEDIA_KIND.video);
  });

  it("returns gif for GIF stickers", () => {
    expect(
      previewMediaKind([ready(MEDIA_KIND.thumbnail), ready(MEDIA_KIND.gif)]),
    ).toBe(MEDIA_KIND.gif);
  });
});

describe("whatsappOgImageKind", () => {
  it("prefers dedicated og when ready", () => {
    expect(
      whatsappOgImageKind([
        {
          kind: MEDIA_KIND.og,
          status: MEDIA_ASSET_STATUS.ready,
          width: 512,
          sizeBytes: 80_000,
        },
        {
          kind: MEDIA_KIND.image,
          status: MEDIA_ASSET_STATUS.ready,
          width: 1024,
          sizeBytes: 400_000,
        },
      ]),
    ).toBe(MEDIA_KIND.og);
  });

  it("prefers image when under 600KB and wide enough", () => {
    expect(
      whatsappOgImageKind([
        {
          kind: MEDIA_KIND.image,
          status: MEDIA_ASSET_STATUS.ready,
          width: 1024,
          sizeBytes: 400_000,
        },
        {
          kind: MEDIA_KIND.gif,
          status: MEDIA_ASSET_STATUS.ready,
          width: 512,
          sizeBytes: 200_000,
        },
        ready(MEDIA_KIND.thumbnail),
        ready(MEDIA_KIND.chat),
      ]),
    ).toBe(MEDIA_KIND.image);
  });

  it("uses gif (not image) when VIDEO is present — image slot is mp4", () => {
    expect(
      whatsappOgImageKind([
        {
          kind: MEDIA_KIND.image,
          status: MEDIA_ASSET_STATUS.ready,
          width: 1024,
          sizeBytes: 400_000,
        },
        {
          kind: MEDIA_KIND.gif,
          status: MEDIA_ASSET_STATUS.ready,
          width: 512,
          sizeBytes: 200_000,
        },
        ready(MEDIA_KIND.video),
      ]),
    ).toBe(MEDIA_KIND.gif);
  });

  it("uses gif when image is over budget and gif fits", () => {
    expect(
      whatsappOgImageKind([
        {
          kind: MEDIA_KIND.image,
          status: MEDIA_ASSET_STATUS.ready,
          width: 1024,
          sizeBytes: 900_000,
        },
        {
          kind: MEDIA_KIND.gif,
          status: MEDIA_ASSET_STATUS.ready,
          width: 512,
          sizeBytes: 500_000,
        },
        ready(MEDIA_KIND.thumbnail),
      ]),
    ).toBe(MEDIA_KIND.gif);
  });

  it("never picks chat or thumbnail", () => {
    expect(
      whatsappOgImageKind([
        {
          kind: MEDIA_KIND.chat,
          status: MEDIA_ASSET_STATUS.ready,
          width: 128,
          sizeBytes: 10_000,
        },
        {
          kind: MEDIA_KIND.thumbnail,
          status: MEDIA_ASSET_STATUS.ready,
          width: 256,
          sizeBytes: 20_000,
        },
      ]),
    ).toBeNull();
  });

  it("falls back to over-budget image rather than undersized thumbs", () => {
    expect(
      whatsappOgImageKind([
        {
          kind: MEDIA_KIND.image,
          status: MEDIA_ASSET_STATUS.ready,
          width: 1024,
          sizeBytes: 1_200_000,
        },
        {
          kind: MEDIA_KIND.thumbnail,
          status: MEDIA_ASSET_STATUS.ready,
          width: 256,
          sizeBytes: 40_000,
        },
      ]),
    ).toBe(MEDIA_KIND.image);
  });
});

describe("encodeWhatsAppOg", () => {
  it("produces a 512 JPEG under the WhatsApp byte cap", async () => {
    // Solid RGBA PNG via sharp so we don't need a fixture file.
    const { default: sharp } = await import("sharp");
    const full = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 241, g: 14, b: 160, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const og = await encodeWhatsAppOg(new Uint8Array(full));
    expect(og.width).toBe(WHATSAPP_OG_SIZE);
    expect(og.height).toBe(WHATSAPP_OG_SIZE);
    expect(og.mime).toBe("image/jpeg");
    expect(og.ext).toBe("jpg");
    expect(og.bytes.byteLength).toBeGreaterThan(0);
    expect(og.bytes.byteLength).toBeLessThanOrEqual(WHATSAPP_OG_MAX_BYTES);
  });
});
