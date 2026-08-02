-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "tree_sha" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tree_synced_at" TIMESTAMP(3),
ADD COLUMN     "tree_truncated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "blob_metrics" (
    "sha" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "lines" INTEGER,
    "measured_at" TIMESTAMP(3),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blob_metrics_pkey" PRIMARY KEY ("sha")
);

-- CreateTable
CREATE TABLE "tree_files" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "blob_sha" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tree_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tree_files_repository_id_blob_sha_idx" ON "tree_files"("repository_id", "blob_sha");

-- CreateIndex
CREATE UNIQUE INDEX "tree_files_repository_id_path_key" ON "tree_files"("repository_id", "path");

-- AddForeignKey
ALTER TABLE "tree_files" ADD CONSTRAINT "tree_files_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

