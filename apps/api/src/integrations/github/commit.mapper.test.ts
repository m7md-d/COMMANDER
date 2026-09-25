/**
 * Reading GitHub's commit JSON. The scenario reference covers what the rules make
 * of it; this pins the fields themselves, because a field dropped here is missed
 * by nothing downstream — it is simply not there.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { toCommitDetail } from "@/integrations/github/commit.mapper.js";

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
