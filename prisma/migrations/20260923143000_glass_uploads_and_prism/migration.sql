-- AlterTable
ALTER TABLE "users" ADD COLUMN "glass_private_prism_id" UUID;

-- CreateTable
CREATE TABLE "glass_uploads" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "object_id" UUID NOT NULL,
    "prism_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "checksum" VARCHAR(128),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "glass_uploads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "glass_uploads_user_id_idx" ON "glass_uploads"("user_id");

ALTER TABLE "glass_uploads" ADD CONSTRAINT "glass_uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
