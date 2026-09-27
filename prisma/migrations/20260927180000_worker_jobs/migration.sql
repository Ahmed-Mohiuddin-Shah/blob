-- Distributed encode workers: API keys, fleet rows, durable jobs.

CREATE TABLE "worker_api_keys" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "key_hash" CHAR(64) NOT NULL,
    "prefix" VARCHAR(16) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "worker_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "worker_api_keys_key_hash_key" ON "worker_api_keys"("key_hash");

CREATE TABLE "workers" (
    "id" BIGSERIAL NOT NULL,
    "api_key_id" BIGINT NOT NULL,
    "instance_id" VARCHAR(64) NOT NULL,
    "version" VARCHAR(40) NOT NULL DEFAULT '0',
    "capabilities" TEXT NOT NULL DEFAULT '[]',
    "concurrency" INTEGER NOT NULL DEFAULT 1,
    "cpu_pct" DOUBLE PRECISION,
    "mem_mb" DOUBLE PRECISION,
    "status" VARCHAR(20) NOT NULL DEFAULT 'offline',
    "last_heartbeat_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workers_api_key_id_instance_id_key" ON "workers"("api_key_id", "instance_id");
CREATE INDEX "workers_status_last_heartbeat_at_idx" ON "workers"("status", "last_heartbeat_at");

ALTER TABLE "workers" ADD CONSTRAINT "workers_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "worker_api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "jobs" (
    "id" BIGSERIAL NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "subject_type" VARCHAR(40) NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "idempotency_key" VARCHAR(120) NOT NULL,
    "payload" JSONB,
    "result" JSONB,
    "worker_id" BIGINT,
    "lease_expires_at" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jobs_idempotency_key_key" ON "jobs"("idempotency_key");
CREATE INDEX "jobs_status_lease_expires_at_idx" ON "jobs"("status", "lease_expires_at");
CREATE INDEX "jobs_type_status_idx" ON "jobs"("type", "status");
CREATE INDEX "jobs_subject_type_subject_id_idx" ON "jobs"("subject_type", "subject_id");

ALTER TABLE "jobs" ADD CONSTRAINT "jobs_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
