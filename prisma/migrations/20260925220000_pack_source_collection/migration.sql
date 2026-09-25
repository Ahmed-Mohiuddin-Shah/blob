-- AlterTable
ALTER TABLE "sticker_packs" ADD COLUMN "source_collection_id" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "sticker_packs_source_collection_id_key" ON "sticker_packs"("source_collection_id");

-- AddForeignKey
ALTER TABLE "sticker_packs" ADD CONSTRAINT "sticker_packs_source_collection_id_fkey" FOREIGN KEY ("source_collection_id") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
