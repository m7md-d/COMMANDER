-- AlterTable
ALTER TABLE "report_schedules" ADD COLUMN     "last_state" JSONB NOT NULL DEFAULT '{}';

