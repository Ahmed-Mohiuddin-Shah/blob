-- Favorites: switch to id PK for cursor pagination
ALTER TABLE "favorites" DROP CONSTRAINT "favorites_pkey";
ALTER TABLE "favorites" ADD COLUMN "id" BIGSERIAL NOT NULL;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "favorites_user_id_subject_type_subject_id_key" ON "favorites"("user_id", "subject_type", "subject_id");
