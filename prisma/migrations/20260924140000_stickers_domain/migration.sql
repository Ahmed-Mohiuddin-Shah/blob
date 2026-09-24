-- CreateTable
CREATE TABLE "categories" (
    "id" BIGSERIAL NOT NULL,
    "parent_id" BIGINT,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" BIGSERIAL NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stickers" (
    "id" BIGSERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "slug" VARCHAR(220) NOT NULL,
    "created_by" BIGINT NOT NULL,
    "uploaded_by" BIGINT NOT NULL,
    "category_id" BIGINT,
    "author_name" VARCHAR(200),
    "attribution" TEXT,
    "source_url" VARCHAR(2048),
    "license" VARCHAR(100),
    "copyright_status" VARCHAR(50),
    "alternate_names" TEXT,
    "keywords" TEXT,
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'public',
    "moderation_status" VARCHAR(30) NOT NULL DEFAULT 'pending_review',
    "processing_status" VARCHAR(20) NOT NULL DEFAULT 'processing',
    "processing_error" TEXT,
    "fit_mode" VARCHAR(10) NOT NULL DEFAULT 'pad',
    "pad_background" VARCHAR(30) NOT NULL DEFAULT 'transparent',
    "views_count" BIGINT NOT NULL DEFAULT 0,
    "downloads_count" BIGINT NOT NULL DEFAULT 0,
    "likes_count" BIGINT NOT NULL DEFAULT 0,
    "shares_count" BIGINT NOT NULL DEFAULT 0,
    "search_appearances_count" BIGINT NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stickers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sticker_tags" (
    "sticker_id" BIGINT NOT NULL,
    "tag_id" BIGINT NOT NULL,

    CONSTRAINT "sticker_tags_pkey" PRIMARY KEY ("sticker_id","tag_id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" BIGSERIAL NOT NULL,
    "sticker_id" BIGINT NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_extension" VARCHAR(20) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "frame_count" INTEGER,
    "has_audio" BOOLEAN NOT NULL DEFAULT false,
    "size_bytes" BIGINT NOT NULL DEFAULT 0,
    "checksum_sha256" CHAR(64),
    "glass_object_id" UUID NOT NULL,
    "glass_prism_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "stickers_slug_key" ON "stickers"("slug");

-- CreateIndex
CREATE INDEX "stickers_moderation_status_processing_status_visibility_idx" ON "stickers"("moderation_status", "processing_status", "visibility");

-- CreateIndex
CREATE INDEX "stickers_uploaded_by_idx" ON "stickers"("uploaded_by");

-- CreateIndex
CREATE INDEX "stickers_category_id_idx" ON "stickers"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_sticker_id_kind_key" ON "media_assets"("sticker_id", "kind");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stickers" ADD CONSTRAINT "stickers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stickers" ADD CONSTRAINT "stickers_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stickers" ADD CONSTRAINT "stickers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sticker_tags" ADD CONSTRAINT "sticker_tags_sticker_id_fkey" FOREIGN KEY ("sticker_id") REFERENCES "stickers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sticker_tags" ADD CONSTRAINT "sticker_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_sticker_id_fkey" FOREIGN KEY ("sticker_id") REFERENCES "stickers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
