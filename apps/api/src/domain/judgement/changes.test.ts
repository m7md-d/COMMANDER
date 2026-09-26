/**
 * What a push changed, and what each changed file was before. Every wrong
 * answer here is a charge: a file read as new when it moved is a crossing
 * nobody made, and a span read from the wrong commit judges someone else's work.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { NormalizedCommit, NormalizedPush } from "@commander/shared";
import { pushChanges, pushSpan } from "./changes.js";

function commit(sha: string, moves: [string, string][] = []): NormalizedCommit {
  return {
    sha,
    title: "File the report with the others",
    url: "",
    timestamp: "2026-08-10T10:00:00+03:00",
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: 1,
    authorLogin: "sara",
    committerLogin: "sara",
    parents: ["p0"],
    paths: [],
    moves,
  };
}

function push(commits: NormalizedCommit[], overrides: Partial<NormalizedPush> = {}): NormalizedPush {
  return {
    repoFullName: "team/repo",
    repoUrl: "",
    branch: "feature/export",
    ref: "refs/heads/feature/export",
    forced: false,
    created: false,
    deleted: false,
    compareUrl: "",
    actorLogin: "sara",
    actorAvatarUrl: "",
    commits,
    truncated: false,
    ...overrides,
  };
}

const REPORT = { path: "src/core/report.ts", sha: "long" };

test("a push is measured between the head it replaced and the head it made", () => {
  const moved = push([commit("c1")], { before: "b".repeat(40), after: "a".repeat(40) });

  assert.deepEqual(pushSpan(moved), { base: "b".repeat(40), head: "a".repeat(40) });
});

test("a new branch, or a push rebuilt without an event, is measured from where its oldest commit was made", () => {
  const created = push([commit("c1"), commit("c2")], { before: "0".repeat(40), after: "c2" });
  const rebuilt = push([commit("c1"), commit("c2")]);

  assert.deepEqual(pushSpan(created), { base: "p0", head: "c2" });
  assert.deepEqual(pushSpan(rebuilt), { base: "p0", head: "c2" });
});

test("nothing is measured when an end cannot be known", () => {
  const root = push([{ ...commit("c1"), parents: [] }], { before: "0".repeat(40), after: "c1" });

  assert.equal(pushSpan(push([], { deleted: true, before: "b".repeat(40), after: "0".repeat(40) })), null);
  assert.equal(pushSpan(root), null, "a first commit has nothing before it to be measured against");
  assert.equal(pushSpan(push([{ ...commit("c1"), parents: undefined }])), null, "unenriched: no parent to start from");
});

test("a file moved unchanged keeps the blob it had, even with no move on record", () => {
  const changes = pushChanges({
    before: [REPORT],
    after: [{ path: "src/reports/monthly.ts", sha: "long" }],
    push: push([commit("c1")]),
  });

  assert.deepEqual(changes, [{ path: "src/reports/monthly.ts", sha: "long", previousSha: "long" }]);
});

test("a file moved and then edited is measured against what it was at its old path", () => {
  const changes = pushChanges({
    before: [REPORT],
    after: [{ path: "src/reports/monthly.ts", sha: "edited" }],
    push: push([commit("c1", [["src/core/report.ts", "src/reports/monthly.ts"]]), commit("c2")]),
  });

  assert.deepEqual(changes, [{ path: "src/reports/monthly.ts", sha: "edited", previousSha: "long" }]);
});

test("a file moved twice in one push is followed back to where it started", () => {
  const moves = push([
    commit("c1", [["src/core/report.ts", "src/reports/report.ts"]]),
    commit("c2", [["src/reports/report.ts", "src/reports/monthly.ts"]]),
  ]);
  const changes = pushChanges({ before: [REPORT], after: [{ path: "src/reports/monthly.ts", sha: "edited" }], push: moves });

  assert.equal(changes[0]?.previousSha, "long");
});

test("a file no move names and no content matches is new", () => {
  const changes = pushChanges({
    before: [REPORT],
    after: [REPORT, { path: "src/core/refunds.ts", sha: "fresh" }],
    push: push([commit("c1")]),
  });

  assert.deepEqual(changes, [{ path: "src/core/refunds.ts", sha: "fresh", previousSha: null }]);
});
