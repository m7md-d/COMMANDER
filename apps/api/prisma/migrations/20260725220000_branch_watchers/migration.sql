-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "watchers" JSONB NOT NULL DEFAULT '[]';
