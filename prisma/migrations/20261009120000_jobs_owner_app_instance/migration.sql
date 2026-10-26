-- Local job ownership (catalog_reindex / encode fallback) across app replicas.
ALTER TABLE "jobs" ADD COLUMN "owner_app_instance_id" VARCHAR(64);
