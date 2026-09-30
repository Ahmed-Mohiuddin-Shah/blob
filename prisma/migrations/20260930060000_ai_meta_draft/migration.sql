-- AlterTable
ALTER TABLE "stickers" ADD COLUMN IF NOT EXISTS "ai_meta_draft" JSONB;
