/**
 * The reconciler rebuilds what the webhook missed during downtime from REST
 * commit data. Two things must not regress: a branch's gap becomes one
 * recovered push naming no pusher — never a push per author, which invented
 * pushes and charged authors for what others pushed — and each commit keeps its
 * author and its committer, which the rules read.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { GITHUB_UI_COMMITTER, isTrunk } from "@commander/shared";
import type { CommitListEntry } from "@/integrations/github/commits.client.js";
import { RECONCILE_LOOKBACK_MS } from "@/config/constants.js";
import { branchesToReconcile, readSince, recoveredPush } from "@/queue/reconciler.mapper.js";

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

test("it carries the default branch, so what it holds on main is weighed as main-line work", () => {
  const roleOf = (branch: string) => {
    const push = recoveredPush(REPO, branch, [entry()]);
    assert.equal(push?.defaultBranch, "main");
    return isTrunk({ branch, defaultBranch: push?.defaultBranch, watchers: [] });
  };

  // Without it a charge on main recovered here was recorded as a work branch's,
  // at half the weight of the same charge arriving by webhook (docs/DEFECTS.md D-17).
  assert.equal(roleOf("main"), true);
  assert.equal(roleOf("feature/export"), false);
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

const HEADS = new Map([
  ["main", "m1"],
  ["release/1.0", "r1"],
  ["release/2.0", "r2"],
  ["feature/export", "f1"],
]);
const NEVER_READ = new Map<string, string>();
const BY_TIME = (branch: string, head: string | null = HEADS.get(branch) ?? null) => ({ branch, beyond: null, head });
const BEYOND_MAIN = (branch: string, head: string | null = HEADS.get(branch) ?? null) => ({ branch, beyond: "main", head });
const reads = (watch: string[], lastRead = NEVER_READ) =>
  branchesToReconcile({ watch, existing: HEADS, lastRead, defaultBranch: "main" });

test("a front that watches every branch is read on every branch, not on its default alone (D-24)", () => {
  for (const watch of [[], ["*"]]) {
    assert.deepEqual(reads(watch), [BY_TIME("main"), BEYOND_MAIN("release/1.0"), BEYOND_MAIN("release/2.0"), BEYOND_MAIN("feature/export")]);
  }
});

test("a branch whose head has not moved since it was last read costs no request", () => {
  const lastRead = new Map([...HEADS, ["feature/export", "f0"]]);

  assert.deepEqual(reads([], lastRead), [BEYOND_MAIN("feature/export")]);
  assert.deepEqual(reads(["main", "release/*"], lastRead), []);
});

test("any other branch is read only beyond the default, never on the default in its place", () => {
  assert.deepEqual(reads(["release/*"]), [BEYOND_MAIN("release/1.0"), BEYOND_MAIN("release/2.0")]);
  assert.deepEqual(reads(["main", "release/*"]), [BY_TIME("main"), BEYOND_MAIN("release/1.0"), BEYOND_MAIN("release/2.0")]);
});

test("a named branch that does not exist is not read", () => {
  assert.deepEqual(reads(["main", "develop"]), [BY_TIME("main")]);
});

test("without a listing, the named branches are read and the patterns are not", () => {
  const unlisted = (watch: string[]) => branchesToReconcile({ watch, existing: null, lastRead: NEVER_READ, defaultBranch: "main" });

  assert.deepEqual(unlisted(["release/1.0", "release/*"]), [BEYOND_MAIN("release/1.0", null)]);
  assert.deepEqual(unlisted([]), [BY_TIME("main", null)]);
});

test("without the default branch nothing is read: inherited work could not be told from pushed work", () => {
  for (const watch of [[], ["release/*"]]) {
    assert.deepEqual(branchesToReconcile({ watch, existing: HEADS, lastRead: NEVER_READ, defaultBranch: null }), []);
  }
});

test("a pass reads from the lookback floor, or from when the front began, whatever is on record (D-23)", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const floor = now - RECONCILE_LOOKBACK_MS;

  assert.equal(readSince({ now, watchedSince: 0 }), floor);
  // Before the front existed nobody was listening, so nothing there was lost.
  assert.equal(readSince({ now, watchedSince: now - 1_000 }), now - 1_000);
});
