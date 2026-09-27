-- AlterTable
ALTER TABLE "stickers" ADD COLUMN     "collection_membership_count" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "print_membership_count" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "popularity_score" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "search_meta_status" VARCHAR(30) NOT NULL DEFAULT 'none',
ADD COLUMN     "ai_caption" TEXT,
ADD COLUMN     "ai_scenario" TEXT,
ADD COLUMN     "ai_visual_tags" TEXT,
ADD COLUMN     "search_indexed_at" TIMESTAMPTZ(6);
