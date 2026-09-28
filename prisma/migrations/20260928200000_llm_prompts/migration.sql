-- Superadmin-tunable LLM prompt bodies
CREATE TABLE "llm_prompts" (
    "key" VARCHAR(64) NOT NULL,
    "body" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by_id" BIGINT,

    CONSTRAINT "llm_prompts_pkey" PRIMARY KEY ("key")
);
