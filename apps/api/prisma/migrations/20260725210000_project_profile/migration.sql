-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "project_brief" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "project_stage" TEXT NOT NULL DEFAULT 'active';
