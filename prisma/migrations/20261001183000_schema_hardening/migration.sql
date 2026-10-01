-- Blobber CI-unique via stored key (Prisma-visible); drop expression index
ALTER TABLE "blobbers" ADD COLUMN "display_name_key" VARCHAR(200);
UPDATE "blobbers" SET "display_name_key" = lower(trim("display_name"));
ALTER TABLE "blobbers" ALTER COLUMN "display_name_key" SET NOT NULL;
CREATE UNIQUE INDEX "blobbers_display_name_key_key" ON "blobbers"("display_name_key");
DROP INDEX IF EXISTS "blobbers_display_name_ci";

-- Favorites reverse lookup (purge cleanup / who favourited)
CREATE INDEX "favorites_subject_type_subject_id_idx" ON "favorites"("subject_type", "subject_id");

-- Job claim path: pending + type + created order
CREATE INDEX "jobs_status_type_created_at_idx" ON "jobs"("status", "type", "created_at");

-- Public browse sort (partial)
CREATE INDEX "stickers_public_browse_popularity_idx"
  ON "stickers"("popularity_score" DESC, "published_at" DESC)
  WHERE "visibility" = 'public' AND "moderation_status" = 'approved';

-- One pending attribution claim per claimant+sticker
CREATE UNIQUE INDEX "attribution_claims_pending_claimant_sticker_uidx"
  ON "attribution_claims"("claimant_id", "sticker_id")
  WHERE "status" = 'pending';

-- One pending association request per requester+target
CREATE UNIQUE INDEX "blobber_association_requests_pending_uidx"
  ON "blobber_association_requests"("requester_id", "target_blobber_id")
  WHERE "status" = 'pending';

-- One pending blobber edit request per blobber
CREATE UNIQUE INDEX "blobber_edit_requests_pending_blobber_uidx"
  ON "blobber_edit_requests"("blobber_id")
  WHERE "status" = 'pending';
