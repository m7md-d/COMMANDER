-- CreateTable
CREATE TABLE "violation_events" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "delivery_id" TEXT,

    CONSTRAINT "violation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commit_records" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "committed_at" TIMESTAMP(3) NOT NULL,
    "files_changed" INTEGER NOT NULL DEFAULT 0,
    "additions" INTEGER NOT NULL DEFAULT 0,
    "deletions" INTEGER NOT NULL DEFAULT 0,
    "enriched" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "commit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_attributions" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "lines_added" INTEGER NOT NULL DEFAULT 0,
    "lines_removed" INTEGER NOT NULL DEFAULT 0,
    "commit_count" INTEGER NOT NULL DEFAULT 0,
    "last_touched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repo_documents" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repo_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_dossiers" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "risk_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tolerance_tier" TEXT NOT NULL DEFAULT 'exemplary',
    "clean_streak_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "anomaly_count" INTEGER NOT NULL DEFAULT 0,
    "score_by_rule" JSONB NOT NULL DEFAULT '{}',
    "narrative" TEXT,
    "narrative_fingerprint" TEXT,
    "narrative_updated_at" TIMESTAMP(3),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_notes" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "dossier_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "violation_events_repository_id_login_occurred_at_idx" ON "violation_events"("repository_id", "login", "occurred_at");

-- CreateIndex
CREATE INDEX "violation_events_repository_id_occurred_at_idx" ON "violation_events"("repository_id", "occurred_at");

-- CreateIndex
CREATE INDEX "commit_records_repository_id_login_committed_at_idx" ON "commit_records"("repository_id", "login", "committed_at");

-- CreateIndex
CREATE UNIQUE INDEX "commit_records_repository_id_sha_key" ON "commit_records"("repository_id", "sha");

-- CreateIndex
CREATE INDEX "file_attributions_repository_id_login_lines_added_idx" ON "file_attributions"("repository_id", "login", "lines_added");

-- CreateIndex
CREATE UNIQUE INDEX "file_attributions_repository_id_login_path_key" ON "file_attributions"("repository_id", "login", "path");

-- CreateIndex
CREATE UNIQUE INDEX "repo_documents_repository_id_path_key" ON "repo_documents"("repository_id", "path");

-- CreateIndex
CREATE INDEX "member_dossiers_repository_id_risk_score_idx" ON "member_dossiers"("repository_id", "risk_score");

-- CreateIndex
CREATE UNIQUE INDEX "member_dossiers_repository_id_login_key" ON "member_dossiers"("repository_id", "login");

-- CreateIndex
CREATE INDEX "dossier_notes_repository_id_login_created_at_idx" ON "dossier_notes"("repository_id", "login", "created_at");

-- AddForeignKey
ALTER TABLE "violation_events" ADD CONSTRAINT "violation_events_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commit_records" ADD CONSTRAINT "commit_records_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attributions" ADD CONSTRAINT "file_attributions_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_documents" ADD CONSTRAINT "repo_documents_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_dossiers" ADD CONSTRAINT "member_dossiers_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_notes" ADD CONSTRAINT "dossier_notes_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
