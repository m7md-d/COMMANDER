-- The branch a charge was made on, and whether it was a main line then
-- (0009 §3). Nullable: every row written before carried neither, and reading
-- one as a main line or a work branch would be a guess — such rows keep the
-- weight they were given.
ALTER TABLE "ledger_events" ADD COLUMN "branch" TEXT,
ADD COLUMN "main_line" BOOLEAN;
