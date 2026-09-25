-- CreateTable
CREATE TABLE "processing_logs" (
    "id" BIGSERIAL NOT NULL,
    "subject_type" VARCHAR(40) NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "subject_title" VARCHAR(220) NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processing_logs_created_at_idx" ON "processing_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "processing_logs_subject_type_subject_id_created_at_idx" ON "processing_logs"("subject_type", "subject_id", "created_at" DESC);

-- AlterTable
ALTER TABLE "collections" ADD COLUMN "likes_count" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sticker_sheets" ADD COLUMN "likes_count" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sticker_packs" ADD COLUMN "likes_count" BIGINT NOT NULL DEFAULT 0;

-- Backfill denormalized like tallies from favorites
UPDATE "collections" c
SET "likes_count" = (
  SELECT COUNT(*)::bigint FROM "favorites" f
  WHERE f."subject_type" = 'collection' AND f."subject_id" = c."id"
);

UPDATE "sticker_sheets" s
SET "likes_count" = (
  SELECT COUNT(*)::bigint FROM "favorites" f
  WHERE f."subject_type" = 'sticker_sheet' AND f."subject_id" = s."id"
);

UPDATE "sticker_packs" p
SET "likes_count" = (
  SELECT COUNT(*)::bigint FROM "favorites" f
  WHERE f."subject_type" = 'sticker_pack' AND f."subject_id" = p."id"
);
