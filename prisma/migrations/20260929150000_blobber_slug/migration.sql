-- AlterTable
ALTER TABLE "blobbers" ADD COLUMN "slug" VARCHAR(220);

-- Backfill from display_name (slugify-ish), then disambiguate collisions with -id
UPDATE "blobbers"
SET "slug" = NULLIF(
  trim(both '-' from lower(regexp_replace(trim("display_name"), '[^a-zA-Z0-9]+', '-', 'g'))),
  ''
);

UPDATE "blobbers" SET "slug" = 'blobber-' || "id"::text WHERE "slug" IS NULL;
UPDATE "blobbers" SET "slug" = 'blobber-' || "id"::text WHERE "slug" = 'id';

UPDATE "blobbers" AS b
SET "slug" = b."slug" || '-' || b."id"::text
WHERE b."id" IN (
  SELECT "id" FROM (
    SELECT "id",
      ROW_NUMBER() OVER (PARTITION BY "slug" ORDER BY "id") AS rn
    FROM "blobbers"
  ) t
  WHERE t.rn > 1
);

ALTER TABLE "blobbers" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "blobbers_slug_key" ON "blobbers"("slug");
