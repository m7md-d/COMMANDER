/**
 * What a commit's API view puts into the push the rules read. The paths decide a
 * merge's residue: a path missing here is a path the merge appears to have
 * written by itself, and the rule charges whoever merged it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { NormalizedCommit } from "@commander/shared";
import type { CommitFileChange } from "@/integrations/github/github.client.js";
import { applyDetail, enrichWith, MAX_ENRICHED_COMMITS } from "@/queue/push.detail.js";

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

test("each file keeps the blob the commit left it with, and null where it went (0011)", () => {
  const withSha = (change: CommitFileChange, sha: string): CommitFileChange => ({ ...change, sha });
  const read = applyDetail(COMMIT, {
    sha: "c1",
    additions: 1,
    deletions: 1,
    parents: ["p0"],
    files: [withSha(file("src/a.ts", "modified"), "b1"), withSha(file("src/new.ts", "renamed", "src/old.ts"), "b2"), withSha(file("src/gone.ts", "removed"), "b0")],
    complete: true,
  });

  assert.deepEqual(read.blobs, [
    ["src/a.ts", "b1"],
    ["src/old.ts", null],
    ["src/new.ts", "b2"],
    ["src/gone.ts", null],
  ]);
});

test("a file without its blob leaves the commit's blobs unread, never half-read", () => {
  const read = applyDetail(COMMIT, { sha: "c1", additions: 1, deletions: 0, parents: ["p0"], files: [{ ...file("src/a.ts", "modified"), sha: "b1" }, file("src/b.ts", "modified")], complete: true });

  assert.equal(read.blobs, undefined);
  assert.deepEqual(read.paths, ["src/a.ts", "src/b.ts"], "the paths are still read");
});

test("a push is read up to the cap and no further, and the rest is left as it came (D-27)", async () => {
  const commits = Array.from({ length: MAX_ENRICHED_COMMITS + 1 }, (_, at) => ({ ...COMMIT, sha: `c${at}` }));
  const push = { repoFullName: "team/repo", repoUrl: "", branch: "main", ref: "refs/heads/main", forced: false, created: false, deleted: false, compareUrl: "", actorLogin: "sara", actorAvatarUrl: "", commits, truncated: false };
  const asked: string[] = [];

  const { enriched } = await enrichWith(push, async (sha) => {
    asked.push(sha);
    return { ok: true, data: { sha, additions: 1, deletions: 0, parents: ["p"], files: [], complete: true } };
  });

  assert.equal(MAX_ENRICHED_COMMITS, 250, "a push of 21 commits went unread at 20");
  assert.equal(enriched, MAX_ENRICHED_COMMITS);
  assert.equal(asked.length, MAX_ENRICHED_COMMITS);
});
