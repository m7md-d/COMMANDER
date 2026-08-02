-- The notes a team leaves itself, and how long they have been there.
--
-- Two places, because they answer two questions. `blob_metrics.markers` says
-- what is in a piece of content and is keyed by its hash, so it is read once
-- ever. `todo_markers` says what is in *this project and since when*, which
-- cannot live on a content hash: editing the line above a note changes the hash
-- without changing the note.
ALTER TABLE "blob_metrics" ADD COLUMN "markers" JSONB;
ALTER TABLE "blob_metrics" ADD COLUMN "markers_at" TIMESTAMP(3);

CREATE TABLE "todo_markers" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_markers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "todo_markers_repository_id_fingerprint_key"
  ON "todo_markers"("repository_id", "fingerprint");
CREATE INDEX "todo_markers_repository_id_first_seen_at_idx"
  ON "todo_markers"("repository_id", "first_seen_at");

ALTER TABLE "todo_markers" ADD CONSTRAINT "todo_markers_repository_id_fkey"
  FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
