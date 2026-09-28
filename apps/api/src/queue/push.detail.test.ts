/**
 * What a commit's API view puts into the push the rules read. The paths decide a
 * merge's residue: a path missing here is a path the merge appears to have
 * written by itself, and the rule charges whoever merged it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { NormalizedCommit } from "@commander/shared";
import type { CommitFileChange } from "@/integrations/github/github.client.js";
import { applyDetail } from "@/queue/push.detail.js";

const COMMIT: NormalizedCommit = {
  sha: "c1",
  title: "Give the totals module its name",
  url: "",
  timestamp: "2026-08-10T10:00:00+03:00",
  filesAdded: 0,
  filesRemoved: 0,
  filesModified: 0,
  authorLogin: "sara",
  committerLogin: "sara",
};

const file = (path: string, status: string, previousPath?: string): CommitFileChange => ({
  path,
  status,
  additions: 1,
  deletions: 0,
  ...(previousPath !== undefined && { previousPath }),
});

const pathsOf = (files: CommitFileChange[]) =>
  applyDetail(COMMIT, { sha: "c1", additions: 1, deletions: 0, parents: ["p0"], files, complete: true }).paths;

test("a listing GitHub may have cut keeps its lines and parents, and gives no paths", () => {
  // Paths missing from it would read as work nobody did, or as a merge's own.
  const read = applyDetail(COMMIT, { sha: "c1", additions: 9, deletions: 2, parents: ["p0", "p1"], files: [file("src/a.ts", "added")], complete: false });

  assert.equal(read.additions, 9);
  assert.deepEqual(read.parents, ["p0", "p1"], "still a merge, whatever its files");
  assert.equal(read.paths, undefined);
  assert.equal(read.moves, undefined);
});

test("a rename touches the path it left as well as the one it made", () => {
  const paths = pathsOf([file("src/totals.ts", "renamed", "src/totals-legacy.ts")]);

  assert.deepEqual(paths, ["src/totals.ts", "src/totals-legacy.ts"]);
});

test("a path renamed away and written again in the same commit is listed once", () => {
  const paths = pathsOf([file("src/b.ts", "renamed", "src/a.ts"), file("src/a.ts", "added")]);

  assert.deepEqual(paths, ["src/b.ts", "src/a.ts"]);
});

test("a rename is kept as a move, so a moved file can be followed to where it was", () => {
  const applied = applyDetail(COMMIT, {
    sha: "c1",
    additions: 0,
    deletions: 0,
    parents: ["p0"],
    files: [file("src/totals.ts", "renamed", "src/totals-legacy.ts"), file("src/ledger.ts", "modified")],
    complete: true,
  });

  assert.deepEqual(applied.moves, [["src/totals-legacy.ts", "src/totals.ts"]]);
});
