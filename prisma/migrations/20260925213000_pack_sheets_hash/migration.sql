-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- AlterTable
ALTER TABLE "sticker_packs" ADD COLUMN "sheets_hash" VARCHAR(64);

-- Backfill from pack_sheets (sorted sheet ids → sha256 hex)
UPDATE "sticker_packs" p
SET "sheets_hash" = encode(
  digest(
    COALESCE(
      (
        SELECT string_agg(ps."sheet_id"::text, ',' ORDER BY ps."sheet_id")
        FROM "pack_sheets" ps
        WHERE ps."pack_id" = p."id"
      ),
      p."id"::text
    ),
    'sha256'
  ),
  'hex'
);

-- Legacy duplicates: keep lowest id with the shared hash; suffix others so UNIQUE applies
UPDATE "sticker_packs" p
SET "sheets_hash" = left(p."sheets_hash", 55) || '-' || p."id"::text
WHERE p."id" IN (
  SELECT p2."id"
  FROM "sticker_packs" p2
  WHERE EXISTS (
    SELECT 1
    FROM "sticker_packs" p3
    WHERE p3."sheets_hash" = p2."sheets_hash"
      AND p3."id" < p2."id"
  )
);

ALTER TABLE "sticker_packs" ALTER COLUMN "sheets_hash" SET NOT NULL;

CREATE UNIQUE INDEX "sticker_packs_sheets_hash_key" ON "sticker_packs"("sheets_hash");
