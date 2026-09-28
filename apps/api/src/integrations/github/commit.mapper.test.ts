/**
 * Reading GitHub's commit JSON. The scenario reference covers what the rules make
 * of it; this pins the fields themselves, because a field dropped here is missed
 * by nothing downstream — it is simply not there.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { COMMIT_FILES_CAP, nextPage, toCommitDetail, toCommitPull } from "@/integrations/github/commit.mapper.js";

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

test("a commit's files are read from every page GitHub sent, in order", () => {
  const page = (...names: string[]) => ({ sha: "c1", files: names.map((filename) => ({ filename, status: "modified" })) });

  const detail = toCommitDetail(page("src/a.ts", "src/b.ts"), [page("src/c.ts"), page("src/d.ts")]);

  // A first page alone hid a crossing in the 301st file (crossing-in-a-commit-of-310-files).
  assert.deepEqual(detail.files.map((file) => file.path), ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"]);
  assert.equal(detail.complete, true);
});

test("a listing that reached GitHub's 3,000-file cap is not complete: it may have stopped short", () => {
  const files = Array.from({ length: COMMIT_FILES_CAP }, (_, at) => ({ filename: `src/m${at}.ts`, status: "added" }));

  assert.equal(toCommitDetail({ sha: "c1", files: files.slice(0, -1) }).complete, true);
  assert.equal(toCommitDetail({ sha: "c1", files }).complete, false);
});

test("nextPage: the next page GitHub links, and only on GitHub's own API", () => {
  const next = '<https://api.github.com/repositories/9/commits/c1?page=2>; rel="next", <https://api.github.com/repositories/9/commits/c1?page=4>; rel="last"';

  assert.equal(nextPage(next), "/repositories/9/commits/c1?page=2");
  assert.equal(nextPage('<https://api.github.com/repositories/9/commits/c1?page=1>; rel="prev"'), null, "the last page");
  assert.equal(nextPage(null), null);
  // The installation token goes with the request: a link anywhere else is never followed.
  assert.equal(nextPage('<https://example.com/steal?page=2>; rel="next"'), null);
});

test("a pull request is merged only when GitHub says when", () => {
  const merged = toCommitPull({ number: 12, merged_at: "2026-08-10T11:00:00Z", merge_commit_sha: "m1", head: { sha: "s6" } });
  const open = toCommitPull({ number: 13, merged_at: null, merge_commit_sha: "t1", head: { sha: "s9" } });

  assert.deepEqual(merged, { number: 12, merged: true, mergeCommit: "m1", head: "s6" });
  assert.equal(open.merged, false, "an open pull request has a test merge commit, not a landing");
});
