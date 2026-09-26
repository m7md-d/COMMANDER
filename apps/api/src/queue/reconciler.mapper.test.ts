/**
 * The reconciler rebuilds what the webhook missed during downtime from REST
 * commit data. Two things must not regress: a branch's gap becomes one
 * recovered push naming no pusher — never a push per author, which invented
 * pushes and charged authors for what others pushed — and each commit keeps its
 * author and its committer, which the rules read.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { GITHUB_UI_COMMITTER } from "@commander/shared";
import type { CommitListEntry } from "@/integrations/github/commits.client.js";
import { branchesToReconcile, recoveredPush } from "@/queue/reconciler.mapper.js";

const REPO = { fullName: "team/repo", defaultBranch: "main" };

function entry(overrides: Partial<CommitListEntry> = {}): CommitListEntry {
  return {
    sha: "a".repeat(40),
    url: "https://github.com/team/repo/commit/a",
    title: "fix: correct the tax rounding",
    timestamp: "2026-07-01T12:00:00Z",
    authorLogin: "ahmad",
    committerLogin: "ahmad",
    ...overrides,
  };
}

test("a branch's gap is one recovered push, whoever wrote its commits", () => {
  const push = recoveredPush(REPO, "main", [
    entry({ sha: "1", authorLogin: "ahmad" }),
    entry({ sha: "2", authorLogin: "sara" }),
    entry({ sha: "3", authorLogin: "ahmad" }),
  ]);

  assert.ok(push);
  assert.deepEqual(push.commits.map((commit) => [commit.sha, commit.authorLogin]), [
    ["1", "ahmad"],
    ["2", "sara"],
    ["3", "ahmad"],
  ]);
  assert.equal(push.branch, "main");
  assert.equal(push.ref, "refs/heads/main");
});

test("it names no pusher, and is addressed to the author of its newest commit", () => {
  const push = recoveredPush(REPO, "main", [entry({ sha: "1", authorLogin: "sara" }), entry({ sha: "2", authorLogin: "ahmad" })]);

  assert.equal(push?.recovered, true, "git records who wrote and who committed, never who pushed");
  assert.equal(push?.actorLogin, "ahmad");
  assert.equal(recoveredPush(REPO, "main", [entry({ authorLogin: "" })])?.actorLogin, "unknown");
});

test("a web-flow merge keeps its committer login, which the event is read from", () => {
  const push = recoveredPush(REPO, "main", [entry({ sha: "m", authorLogin: "ahmad", committerLogin: GITHUB_UI_COMMITTER })]);

  assert.equal(push?.commits[0]?.committerLogin, GITHUB_UI_COMMITTER);
});

test("commit order is preserved, file counts are unknown, and nothing recovered is no push", () => {
  const push = recoveredPush(REPO, "main", [entry({ sha: "old" }), entry({ sha: "new" })]);

  assert.deepEqual(push?.commits.map((commit) => commit.sha), ["old", "new"]);
  // The list endpoint carries no file data; enrichment backfills it later.
  assert.equal(push?.commits[0]?.filesAdded, 0);
  assert.equal(recoveredPush(REPO, "main", []), null);
});

const BRANCHES = ["main", "release/1.0", "release/2.0", "feature/export"];
const BY_TIME = (branch: string) => ({ branch, beyond: null });
const BEYOND_MAIN = (branch: string) => ({ branch, beyond: "main" });

test("a front that watches every branch is read on its default branch alone, by its history", () => {
  for (const watch of [[], ["*"]]) {
    assert.deepEqual(branchesToReconcile({ watch, existing: BRANCHES, defaultBranch: "main" }), [BY_TIME("main")]);
  }
});

test("any other branch is read only beyond the default, never on the default in its place", () => {
  assert.deepEqual(branchesToReconcile({ watch: ["release/*"], existing: BRANCHES, defaultBranch: "main" }), [
    BEYOND_MAIN("release/1.0"),
    BEYOND_MAIN("release/2.0"),
  ]);
  assert.deepEqual(branchesToReconcile({ watch: ["main", "release/*"], existing: BRANCHES, defaultBranch: "main" }), [
    BY_TIME("main"),
    BEYOND_MAIN("release/1.0"),
    BEYOND_MAIN("release/2.0"),
  ]);
});

test("a named branch that does not exist is not read", () => {
  const reads = branchesToReconcile({ watch: ["main", "develop"], existing: BRANCHES, defaultBranch: "main" });

  assert.deepEqual(reads, [BY_TIME("main")]);
});

test("without a listing, the named branches are read and the patterns are not", () => {
  const reads = branchesToReconcile({ watch: ["release/1.0", "release/*"], existing: null, defaultBranch: "main" });

  assert.deepEqual(reads, [BEYOND_MAIN("release/1.0")]);
});

test("without the default branch nothing is read: inherited work could not be told from pushed work", () => {
  assert.deepEqual(branchesToReconcile({ watch: [], existing: BRANCHES, defaultBranch: null }), []);
  assert.deepEqual(branchesToReconcile({ watch: ["release/*"], existing: BRANCHES, defaultBranch: null }), []);
});
