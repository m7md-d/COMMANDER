-- When reconnaissance last completed for a repository.
-- Nullable on purpose: NULL means "never scanned", which is a different fact
-- from "scanned and found nothing", and the panel has to be able to say which.
ALTER TABLE "repositories" ADD COLUMN "last_scanned_at" TIMESTAMP(3);
