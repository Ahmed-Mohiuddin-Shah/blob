-- CreateTable
CREATE TABLE "landing_config" (
    "id" BIGSERIAL NOT NULL,
    "key" VARCHAR(32) NOT NULL DEFAULT 'default',
    "featured_sticker_ids" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "category_ids" BIGINT[] DEFAULT ARRAY[]::BIGINT[],
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_id" BIGINT,

    CONSTRAINT "landing_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landing_config_key_key" ON "landing_config"("key");
