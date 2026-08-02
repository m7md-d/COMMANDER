-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('pending', 'processing', 'sent', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "branches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "discord_webhook_url" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "silent_when_clean" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL,
    "prompt_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "display_name" TEXT NOT NULL DEFAULT '',
    "rank" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_stats" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "total_commits" INTEGER NOT NULL DEFAULT 0,
    "total_pushes" INTEGER NOT NULL DEFAULT 0,
    "violation_counts" JSONB NOT NULL DEFAULT '{}',
    "first_seen_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "member_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT,
    "repository_full_name" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT '',
    "actor_login" TEXT NOT NULL DEFAULT '',
    "commit_count" INTEGER NOT NULL DEFAULT 0,
    "violation_count" INTEGER NOT NULL DEFAULT 0,
    "status" "delivery_status" NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL DEFAULT 'ok',
    "reason_detail" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "report_text" TEXT,
    "model" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repositories_full_name_key" ON "repositories"("full_name");

-- CreateIndex
CREATE UNIQUE INDEX "members_repository_id_login_key" ON "members"("repository_id", "login");

-- CreateIndex
CREATE INDEX "member_stats_repository_id_total_commits_idx" ON "member_stats"("repository_id", "total_commits");

-- CreateIndex
CREATE UNIQUE INDEX "member_stats_repository_id_login_key" ON "member_stats"("repository_id", "login");

-- CreateIndex
CREATE INDEX "deliveries_status_next_attempt_at_idx" ON "deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "deliveries_repository_id_created_at_idx" ON "deliveries"("repository_id", "created_at");

-- CreateIndex
CREATE INDEX "deliveries_created_at_idx" ON "deliveries"("created_at");

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_stats" ADD CONSTRAINT "member_stats_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
