-- Prints domain: sticker sheets + packs; polymorphic collection items

CREATE TABLE "sticker_sheets" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "description" TEXT,
    "created_by" BIGINT NOT NULL,
    "print_document_json" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "png_glass_object_id" UUID,
    "png_glass_prism_id" UUID,
    "pdf_glass_object_id" UUID,
    "pdf_glass_prism_id" UUID,
    "png_size_bytes" BIGINT,
    "pdf_size_bytes" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sticker_sheets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sticker_sheets_slug_key" ON "sticker_sheets"("slug");
CREATE INDEX "sticker_sheets_status_created_at_idx" ON "sticker_sheets"("status", "created_at" DESC);
CREATE INDEX "sticker_sheets_created_by_idx" ON "sticker_sheets"("created_by");

CREATE TABLE "sheet_stickers" (
    "sheet_id" BIGINT NOT NULL,
    "sticker_id" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sheet_stickers_pkey" PRIMARY KEY ("sheet_id","sticker_id")
);

CREATE INDEX "sheet_stickers_sticker_id_idx" ON "sheet_stickers"("sticker_id");

CREATE TABLE "sticker_packs" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "description" TEXT,
    "created_by" BIGINT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "png_glass_object_id" UUID,
    "png_glass_prism_id" UUID,
    "pdf_glass_object_id" UUID,
    "pdf_glass_prism_id" UUID,
    "png_size_bytes" BIGINT,
    "pdf_size_bytes" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sticker_packs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sticker_packs_slug_key" ON "sticker_packs"("slug");
CREATE INDEX "sticker_packs_status_created_at_idx" ON "sticker_packs"("status", "created_at" DESC);
CREATE INDEX "sticker_packs_created_by_idx" ON "sticker_packs"("created_by");

CREATE TABLE "pack_sheets" (
    "pack_id" BIGINT NOT NULL,
    "sheet_id" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pack_sheets_pkey" PRIMARY KEY ("pack_id","sheet_id")
);

CREATE INDEX "pack_sheets_sheet_id_idx" ON "pack_sheets"("sheet_id");

CREATE TABLE "collection_items" (
    "collection_id" BIGINT NOT NULL,
    "subject_type" VARCHAR(40) NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("collection_id","subject_type","subject_id")
);

CREATE INDEX "collection_items_subject_type_subject_id_idx" ON "collection_items"("subject_type", "subject_id");

-- Migrate existing collection stickers into polymorphic items
INSERT INTO "collection_items" ("collection_id", "subject_type", "subject_id", "sort_order", "added_at")
SELECT "collection_id", 'sticker', "sticker_id", "sort_order", "added_at"
FROM "collection_stickers";

DROP TABLE "collection_stickers";

ALTER TABLE "sticker_sheets" ADD CONSTRAINT "sticker_sheets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sheet_stickers" ADD CONSTRAINT "sheet_stickers_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "sticker_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sheet_stickers" ADD CONSTRAINT "sheet_stickers_sticker_id_fkey" FOREIGN KEY ("sticker_id") REFERENCES "stickers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sticker_packs" ADD CONSTRAINT "sticker_packs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pack_sheets" ADD CONSTRAINT "pack_sheets_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "sticker_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pack_sheets" ADD CONSTRAINT "pack_sheets_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "sticker_sheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
