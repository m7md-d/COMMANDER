/**
 * Reading GitHub's commit JSON. The scenario reference covers what the rules make
 * of it; this pins the fields themselves, because a field dropped here is missed
 * by nothing downstream — it is simply not there.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { toCommitDetail, toCommitPull } from "@/integrations/github/commit.mapper.js";

test("a renamed file keeps the path it came from", () => {
  const detail = toCommitDetail({
    sha: "c1",
    files: [{ filename: "src/totals.ts", status: "renamed", previous_filename: "src/totals-legacy.ts" }],
  });

  assert.deepEqual(detail.files, [
    { path: "src/totals.ts", additions: 0, deletions: 0, status: "renamed", previousPath: "src/totals-legacy.ts" },
  ]);
});

test("a file that was not renamed carries no previous path", () => {
  const detail = toCommitDetail({ sha: "c1", files: [{ filename: "src/totals.ts", status: "modified" }] });

  assert.deepEqual(detail.files, [{ path: "src/totals.ts", additions: 0, deletions: 0, status: "modified" }]);
});

test("a pull request is merged only when GitHub says when", () => {
  const merged = toCommitPull({ number: 12, merged_at: "2026-08-10T11:00:00Z", merge_commit_sha: "m1", head: { sha: "s6" } });
  const open = toCommitPull({ number: 13, merged_at: null, merge_commit_sha: "t1", head: { sha: "s9" } });

  assert.deepEqual(merged, { number: 12, merged: true, mergeCommit: "m1", head: "s6" });
  assert.equal(open.merged, false, "an open pull request has a test merge commit, not a landing");
});
