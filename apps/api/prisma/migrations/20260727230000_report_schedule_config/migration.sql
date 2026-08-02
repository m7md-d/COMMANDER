-- When each front's periodic reports go out.
--
-- Defaulted to an empty object rather than to a written-out config: the shipped
-- default lives in one place (DEFAULT_SCHEDULE) and is applied on read, so
-- changing it later does not mean rewriting rows that never chose anything.
ALTER TABLE "repositories" ADD COLUMN "schedules" JSONB NOT NULL DEFAULT '{}';
