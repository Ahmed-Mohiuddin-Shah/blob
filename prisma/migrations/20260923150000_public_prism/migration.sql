-- CreateTable
CREATE TABLE "public_prism" (
    "id" BIGSERIAL NOT NULL,
    "key" VARCHAR(32) NOT NULL DEFAULT 'default',
    "glass_prism_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_prism_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "public_prism_key_key" ON "public_prism"("key");
CREATE UNIQUE INDEX "public_prism_glass_prism_id_key" ON "public_prism"("glass_prism_id");
