-- Control-plane app presence + which app holds each worker WSS.

CREATE TABLE "app_instances" (
    "id" VARCHAR(64) NOT NULL,
    "hostname" VARCHAR(120) NOT NULL,
    "version" VARCHAR(40) NOT NULL DEFAULT '0',
    "status" VARCHAR(20) NOT NULL DEFAULT 'offline',
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "last_heartbeat_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_instances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_instances_status_last_heartbeat_at_idx" ON "app_instances"("status", "last_heartbeat_at");

ALTER TABLE "workers" ADD COLUMN "connected_app_instance_id" VARCHAR(64);

CREATE INDEX "workers_connected_app_instance_id_idx" ON "workers"("connected_app_instance_id");
