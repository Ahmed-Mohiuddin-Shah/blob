-- Attribution claims + indexes
CREATE TABLE "attribution_claims" (
    "id" BIGSERIAL NOT NULL,
    "sticker_id" BIGINT NOT NULL,
    "claimant_id" BIGINT NOT NULL,
    "reason" VARCHAR(20) NOT NULL,
    "contact_name" VARCHAR(200) NOT NULL,
    "contact_email" VARCHAR(255) NOT NULL,
    "message" TEXT,
    "proposed_author_name" VARCHAR(200) NOT NULL,
    "proposed_source_url" VARCHAR(2048) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attribution_claims_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attribution_claims_status_created_at_idx" ON "attribution_claims"("status", "created_at" DESC);
CREATE INDEX "attribution_claims_sticker_id_idx" ON "attribution_claims"("sticker_id");
CREATE INDEX "attribution_claims_claimant_id_sticker_id_status_idx" ON "attribution_claims"("claimant_id", "sticker_id", "status");

ALTER TABLE "attribution_claims" ADD CONSTRAINT "attribution_claims_sticker_id_fkey" FOREIGN KEY ("sticker_id") REFERENCES "stickers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attribution_claims" ADD CONSTRAINT "attribution_claims_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribution_claims" ADD CONSTRAINT "attribution_claims_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
