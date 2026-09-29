-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "embed" JSONB,
ADD COLUMN     "judgement" JSONB,
ADD COLUMN     "resend_of" TEXT,
ADD COLUMN     "system_prompt" TEXT,
ADD COLUMN     "user_prompt" TEXT;

