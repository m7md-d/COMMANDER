-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "last_run_at" TIMESTAMP(3),

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_schedules_repository_id_kind_key" ON "report_schedules"("repository_id", "kind");

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

