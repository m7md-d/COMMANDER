-- AlterTable
ALTER TABLE "commit_records" ADD COLUMN     "review" JSONB,
ADD COLUMN     "review_model" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3);
