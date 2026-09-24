-- AlterTable
ALTER TABLE "stickers" ADD COLUMN "moderation_note" TEXT;

-- CreateTable
CREATE TABLE "moderation_events" (
    "id" BIGSERIAL NOT NULL,
    "subject_type" VARCHAR(40) NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "subject_title" VARCHAR(220) NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "actor_id" BIGINT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_events_subject_type_subject_id_created_at_idx" ON "moderation_events"("subject_type", "subject_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "moderation_events_created_at_idx" ON "moderation_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "moderation_events_actor_id_idx" ON "moderation_events"("actor_id");

-- AddForeignKey
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
