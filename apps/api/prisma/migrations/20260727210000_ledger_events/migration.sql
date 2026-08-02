-- The table is RENAMED, never recreated.
--
-- `prisma migrate diff` emits DROP + CREATE for a renamed model, because a
-- schema diff cannot tell a rename from a deletion plus an unrelated arrival.
-- The rows in here are the only record of what anyone has ever done, and a
-- standing that can be re-derived from nothing is not a standing. Every
-- statement below preserves them.

ALTER TABLE "violation_events" RENAME TO "ledger_events";

ALTER INDEX "violation_events_pkey" RENAME TO "ledger_events_pkey";
ALTER TABLE "ledger_events"
  RENAME CONSTRAINT "violation_events_repository_id_fkey" TO "ledger_events_repository_id_fkey";

-- Defaulted rather than required: every row written before this column existed
-- was a violation, because nothing else could be recorded then. Backfilling it
-- with a guess would have been the alternative, and this is not a guess.
ALTER TABLE "ledger_events" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'violation';

-- `kind` leads both indexes. Every read of this table now names one, so it is
-- the first thing the index should be able to answer, not a filter applied to
-- rows it already walked.
DROP INDEX "violation_events_repository_id_login_occurred_at_idx";
DROP INDEX "violation_events_repository_id_occurred_at_idx";

CREATE INDEX "ledger_events_repository_id_kind_login_occurred_at_idx"
  ON "ledger_events"("repository_id", "kind", "login", "occurred_at");
CREATE INDEX "ledger_events_repository_id_kind_occurred_at_idx"
  ON "ledger_events"("repository_id", "kind", "occurred_at");
