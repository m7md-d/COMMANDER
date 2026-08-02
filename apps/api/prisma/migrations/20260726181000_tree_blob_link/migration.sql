-- A tree row may never name a blob we never recorded: the measurement is looked
-- up by this key, and a dangling reference would read as "unmeasured" forever
-- instead of as the bug it is.
--
-- RESTRICT rather than CASCADE because content is immutable — a measurement
-- stays true after every path pointing at it has moved or been deleted, and
-- throwing it away would mean paying to measure the same bytes twice.
-- AddForeignKey
ALTER TABLE "tree_files" ADD CONSTRAINT "tree_files_blob_sha_fkey" FOREIGN KEY ("blob_sha") REFERENCES "blob_metrics"("sha") ON DELETE RESTRICT ON UPDATE CASCADE;
