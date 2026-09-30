-- CreateTable
CREATE TABLE "reconciled_heads" (
    "repository_id" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciled_heads_pkey" PRIMARY KEY ("repository_id","branch")
);

-- AddForeignKey
ALTER TABLE "reconciled_heads" ADD CONSTRAINT "reconciled_heads_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
