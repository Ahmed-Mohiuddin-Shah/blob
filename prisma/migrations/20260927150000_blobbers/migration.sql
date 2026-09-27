-- Blobbers: first-class attribution + CMS + association / edit queues

CREATE TABLE "blobbers" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "display_name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "banner_glass_object_id" UUID,
    "avatar_glass_object_id" UUID,
    "show_stickers" BOOLEAN NOT NULL DEFAULT true,
    "show_collections" BOOLEAN NOT NULL DEFAULT true,
    "show_sticker_sheets" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blobbers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blobbers_user_id_key" ON "blobbers"("user_id");
CREATE UNIQUE INDEX "blobbers_display_name_ci" ON "blobbers"(lower("display_name"));

CREATE TABLE "social_links" (
    "id" BIGSERIAL NOT NULL,
    "link_type" VARCHAR(20) NOT NULL,
    "handle" VARCHAR(200) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blobber_social_links" (
    "blobber_id" BIGINT NOT NULL,
    "social_link_id" BIGINT NOT NULL,

    CONSTRAINT "blobber_social_links_pkey" PRIMARY KEY ("blobber_id","social_link_id")
);

CREATE TABLE "blobber_edit_requests" (
    "id" BIGSERIAL NOT NULL,
    "blobber_id" BIGINT NOT NULL,
    "requester_id" BIGINT NOT NULL,
    "proposed_payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blobber_edit_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blobber_association_requests" (
    "id" BIGSERIAL NOT NULL,
    "requester_id" BIGINT NOT NULL,
    "target_blobber_id" BIGINT NOT NULL,
    "message" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blobber_association_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "stickers" ADD COLUMN "blobber_id" BIGINT;

ALTER TABLE "attribution_claims" ADD COLUMN "proposed_blobber_id" BIGINT;
ALTER TABLE "attribution_claims" ADD COLUMN "proposed_blobber_display_name" VARCHAR(200);

-- Backfill unlinked blobbers from distinct author_name (case-insensitive fold)
DO $$
DECLARE
  r RECORD;
  bid BIGINT;
BEGIN
  FOR r IN
    SELECT MIN(author_name) AS display_name, lower(trim(author_name)) AS name_key
    FROM stickers
    WHERE author_name IS NOT NULL AND trim(author_name) <> ''
    GROUP BY lower(trim(author_name))
  LOOP
    INSERT INTO blobbers (display_name, created_at, updated_at)
    VALUES (r.display_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id INTO bid;

    UPDATE stickers
    SET blobber_id = bid
    WHERE author_name IS NOT NULL
      AND lower(trim(author_name)) = r.name_key;
  END LOOP;
END $$;

-- Pending claims: copy proposed_author_name into proposed_blobber_display_name
UPDATE attribution_claims
SET proposed_blobber_display_name = proposed_author_name
WHERE proposed_author_name IS NOT NULL;

ALTER TABLE "stickers" DROP COLUMN IF EXISTS "author_name";
ALTER TABLE "stickers" DROP COLUMN IF EXISTS "attribution";

ALTER TABLE "attribution_claims" DROP COLUMN IF EXISTS "proposed_author_name";
ALTER TABLE "attribution_claims" ALTER COLUMN "proposed_source_url" DROP NOT NULL;

-- FKs
ALTER TABLE "blobbers" ADD CONSTRAINT "blobbers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "blobber_social_links" ADD CONSTRAINT "blobber_social_links_blobber_id_fkey"
  FOREIGN KEY ("blobber_id") REFERENCES "blobbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blobber_social_links" ADD CONSTRAINT "blobber_social_links_social_link_id_fkey"
  FOREIGN KEY ("social_link_id") REFERENCES "social_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "blobber_edit_requests" ADD CONSTRAINT "blobber_edit_requests_blobber_id_fkey"
  FOREIGN KEY ("blobber_id") REFERENCES "blobbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blobber_edit_requests" ADD CONSTRAINT "blobber_edit_requests_requester_id_fkey"
  FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blobber_edit_requests" ADD CONSTRAINT "blobber_edit_requests_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "blobber_association_requests" ADD CONSTRAINT "blobber_association_requests_requester_id_fkey"
  FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blobber_association_requests" ADD CONSTRAINT "blobber_association_requests_target_blobber_id_fkey"
  FOREIGN KEY ("target_blobber_id") REFERENCES "blobbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blobber_association_requests" ADD CONSTRAINT "blobber_association_requests_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stickers" ADD CONSTRAINT "stickers_blobber_id_fkey"
  FOREIGN KEY ("blobber_id") REFERENCES "blobbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attribution_claims" ADD CONSTRAINT "attribution_claims_proposed_blobber_id_fkey"
  FOREIGN KEY ("proposed_blobber_id") REFERENCES "blobbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "stickers_blobber_id_idx" ON "stickers"("blobber_id");
CREATE INDEX "blobber_edit_requests_status_created_at_idx" ON "blobber_edit_requests"("status", "created_at" DESC);
CREATE INDEX "blobber_edit_requests_blobber_id_idx" ON "blobber_edit_requests"("blobber_id");
CREATE INDEX "blobber_association_requests_status_created_at_idx" ON "blobber_association_requests"("status", "created_at" DESC);
CREATE INDEX "blobber_association_requests_requester_id_target_blobber_id_status_idx"
  ON "blobber_association_requests"("requester_id", "target_blobber_id", "status");
