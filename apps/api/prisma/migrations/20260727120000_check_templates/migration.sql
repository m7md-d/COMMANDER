-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "check_template_id" TEXT,
ADD COLUMN     "checks" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "check_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "checks" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "check_templates_name_key" ON "check_templates"("name");

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_check_template_id_fkey" FOREIGN KEY ("check_template_id") REFERENCES "check_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

