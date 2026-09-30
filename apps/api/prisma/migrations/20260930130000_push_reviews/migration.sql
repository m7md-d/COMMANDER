-- CreateTable
CREATE TABLE "push_reviews" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "head" TEXT NOT NULL,
    "login" TEXT,
    "title" TEXT NOT NULL,
    "review" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "push_reviews_repository_id_login_reviewed_at_idx" ON "push_reviews"("repository_id", "login", "reviewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_reviews_repository_id_head_key" ON "push_reviews"("repository_id", "head");

-- AddForeignKey
ALTER TABLE "push_reviews" ADD CONSTRAINT "push_reviews_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
