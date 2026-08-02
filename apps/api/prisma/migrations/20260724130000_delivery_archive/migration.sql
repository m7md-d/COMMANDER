-- Manual archive shelf for deliveries: hide accumulated dispatches from the
-- active view without deleting them. Retention pruning still applies.
ALTER TABLE "deliveries" ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "deliveries_archived_at_created_at_idx" ON "deliveries" ("archived_at", "created_at");
