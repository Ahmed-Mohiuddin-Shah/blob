-- Composition editor unlock: assets + compositions; drop fit_mode

-- CreateTable
CREATE TABLE "assets" (
    "id" BIGSERIAL NOT NULL,
    "uploaded_by" BIGINT NOT NULL,
    "sha256" CHAR(64),
    "mime_type" VARCHAR(100) NOT NULL,
    "file_extension" VARCHAR(20) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "frame_count" INTEGER,
    "frame_rate" DECIMAL(8,3),
    "has_audio" BOOLEAN NOT NULL DEFAULT false,
    "size_bytes" BIGINT NOT NULL DEFAULT 0,
    "glass_object_id" UUID NOT NULL,
    "glass_prism_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- AlterTable stickers: remix FK; drop fit_mode / pad_background
ALTER TABLE "stickers" ADD COLUMN "remixed_from_sticker_id" BIGINT;
ALTER TABLE "stickers" DROP COLUMN IF EXISTS "fit_mode";
ALTER TABLE "stickers" DROP COLUMN IF EXISTS "pad_background";

-- CreateTable
CREATE TABLE "compositions" (
    "id" BIGSERIAL NOT NULL,
    "sticker_id" BIGINT NOT NULL,
    "owner_id" BIGINT NOT NULL,
    "current_revision_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "compositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "composition_revisions" (
    "id" BIGSERIAL NOT NULL,
    "composition_id" BIGINT NOT NULL,
    "revision" INTEGER NOT NULL,
    "document_json" JSONB NOT NULL,
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "composition_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "composition_parents" (
    "composition_id" BIGINT NOT NULL,
    "parent_composition_id" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "composition_parents_pkey" PRIMARY KEY ("composition_id","parent_composition_id")
);

-- AlterTable media_assets
ALTER TABLE "media_assets" ADD COLUMN "composition_revision_id" BIGINT;

-- Migrate legacy originals into assets + synthetic composition (transparent 1024 contain).
-- ponytail: one-shot backfill; reprocess regenerates derivatives via encodeComposition.
DO $$
DECLARE
  r RECORD;
  asset_id BIGINT;
  comp_id BIGINT;
  rev_id BIGINT;
  media_kind TEXT;
  doc JSONB;
BEGIN
  FOR r IN
    SELECT s.id AS sticker_id, s.uploaded_by, s.created_by, m.*
    FROM stickers s
    JOIN media_assets m ON m.sticker_id = s.id AND m.kind = 'original'
  LOOP
    INSERT INTO assets (
      uploaded_by, mime_type, file_extension, width, height, duration_ms, frame_count,
      has_audio, size_bytes, glass_object_id, glass_prism_id, created_at, updated_at
    ) VALUES (
      r.uploaded_by, r.mime_type, r.file_extension, r.width, r.height, r.duration_ms, r.frame_count,
      r.has_audio, r.size_bytes, r.glass_object_id, r.glass_prism_id, NOW(), NOW()
    ) RETURNING id INTO asset_id;

    media_kind := CASE
      WHEN r.mime_type = 'image/gif' THEN 'gif'
      WHEN r.mime_type = 'video/mp4' THEN 'video'
      ELSE 'image'
    END;

    doc := jsonb_build_object(
      'version', 2,
      'canvas', jsonb_build_object('width', 1024, 'height', 1024, 'background', 'transparent'),
      'objects', jsonb_build_array(
        jsonb_build_object(
          'id', 'media_legacy',
          'type', 'media',
          'asset_id', asset_id::text,
          'kind', media_kind,
          'transform', jsonb_build_object('x', 512, 'y', 512, 'scale_x', 1, 'scale_y', 1, 'rotation', 0),
          'crop', NULL,
          'mask_asset_id', NULL,
          'keep', NULL,
          'outline', NULL
        )
      ),
      'duration_ms', 0,
      'fps', 15,
      'audio', NULL
    );

    INSERT INTO compositions (sticker_id, owner_id, created_at, updated_at)
    VALUES (r.sticker_id, r.created_by, NOW(), NOW())
    RETURNING id INTO comp_id;

    INSERT INTO composition_revisions (composition_id, revision, document_json, created_by, created_at)
    VALUES (comp_id, 1, doc, r.created_by, NOW())
    RETURNING id INTO rev_id;

    UPDATE compositions SET current_revision_id = rev_id WHERE id = comp_id;

    UPDATE media_assets
    SET composition_revision_id = rev_id
    WHERE sticker_id = r.sticker_id AND media_assets.kind <> 'original';

    DELETE FROM media_assets WHERE id = r.id;
  END LOOP;
END $$;

-- Indexes / FKs
CREATE INDEX "idx_assets_sha256" ON "assets"("sha256");
CREATE INDEX "idx_assets_glass_object" ON "assets"("glass_object_id");
CREATE INDEX "idx_stickers_remixed_from" ON "stickers"("remixed_from_sticker_id");
CREATE UNIQUE INDEX "compositions_sticker_id_key" ON "compositions"("sticker_id");
CREATE UNIQUE INDEX "uq_composition_revisions" ON "composition_revisions"("composition_id", "revision");
CREATE INDEX "idx_media_assets_revision" ON "media_assets"("composition_revision_id");

ALTER TABLE "assets" ADD CONSTRAINT "assets_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stickers" ADD CONSTRAINT "stickers_remixed_from_sticker_id_fkey" FOREIGN KEY ("remixed_from_sticker_id") REFERENCES "stickers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compositions" ADD CONSTRAINT "compositions_sticker_id_fkey" FOREIGN KEY ("sticker_id") REFERENCES "stickers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compositions" ADD CONSTRAINT "compositions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "composition_revisions" ADD CONSTRAINT "composition_revisions_composition_id_fkey" FOREIGN KEY ("composition_id") REFERENCES "compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "composition_revisions" ADD CONSTRAINT "composition_revisions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "composition_parents" ADD CONSTRAINT "composition_parents_composition_id_fkey" FOREIGN KEY ("composition_id") REFERENCES "compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "composition_parents" ADD CONSTRAINT "composition_parents_parent_composition_id_fkey" FOREIGN KEY ("parent_composition_id") REFERENCES "compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_composition_revision_id_fkey" FOREIGN KEY ("composition_revision_id") REFERENCES "composition_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
