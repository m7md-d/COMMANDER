/**
 * What happened, told from what arrived — each row of 0009 §2's table as an
 * assertion. The scenario reference plays real merges, squashes and edits
 * through these; this pins the facts each one is told by.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { GITHUB_UI_COMMITTER, type NormalizedCommit, type NormalizedPush } from "@commander/shared";
import { normalizePush } from "@/modules/webhook/push.mapper.js";
import { classifyPush, headOf, judgedShas, landedUnreviewed, pullFact, type PullFact } from "./event.js";

function commit(sha: string, overrides: Partial<NormalizedCommit> = {}): NormalizedCommit {
  return {
    sha,
    title: "Export the ledger as CSV",
    url: "",
    timestamp: "2026-08-10T10:00:00+03:00",
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: 1,
    authorLogin: "sara",
    committerLogin: "sara",
    parents: ["p0"],
    ...overrides,
  };
}

function push(commits: NormalizedCommit[], overrides: Partial<NormalizedPush> = {}): NormalizedPush {
  return {
    repoFullName: "team/repo",
    repoUrl: "",
    branch: "main",
    ref: "refs/heads/main",
    forced: false,
    created: false,
    deleted: false,
    compareUrl: "",
    after: commits.at(-1)?.sha ?? "0".repeat(40),
    actorLogin: "sara",
    actorAvatarUrl: "",
    commits,
    truncated: false,
    ...overrides,
  };
}

const GITHUB = { committerLogin: GITHUB_UI_COMMITTER };
const MERGE = { parents: ["p0", "p1"] };
const UNASKED: PullFact = { status: "unasked" };
const NONE: PullFact = { status: "none" };
const LANDED: PullFact = { status: "landed", number: 12, head: "s6" };
const kind = (commits: NormalizedCommit[], pull: PullFact = UNASKED, overrides: Partial<NormalizedPush> = {}) =>
  classifyPush({ push: push(commits, overrides), pull });

test("pullFact: a landing is a merged pull request whose merge made this very head", () => {
  const pulls = [
    { number: 11, merged: false, mergeCommit: "h", head: "x" },
    { number: 12, merged: true, mergeCommit: "h", head: "s6" },
  ];

  assert.deepEqual(pullFact(pulls, "h"), LANDED);
  assert.deepEqual(pullFact(pulls, "other"), NONE, "a commit a pull request only holds was not landed by it");
});

test("headOf: the commit the push left its branch at", () => {
  assert.equal(headOf(push([commit("a"), commit("b")], { after: "a" }))?.sha, "a");
  assert.equal(headOf(push([commit("a"), commit("b")], { after: undefined }))?.sha, "b");
});

test("classifyPush: GitHub's buttons, told apart by the pull request", () => {
  assert.equal(kind([commit("m", { ...GITHUB, ...MERGE })], LANDED), "pr_landing");
  assert.equal(kind([commit("q", GITHUB)], LANDED), "pr_landing", "a squash or a rebase");
  assert.equal(kind([commit("u", { ...GITHUB, ...MERGE })], NONE), "branch_update");
  assert.equal(kind([commit("e", GITHUB)], NONE), "web_edit");
  assert.equal(kind([commit("e", GITHUB)], { status: "unknown" }), "unknown", "without the answer, a landing is the pencil's double");
});

test("classifyPush: someone's own commits, told by the flags and the parents — never the title", () => {
  assert.equal(kind([commit("a"), commit("b")]), "direct_push");
  assert.equal(kind([commit("a", { title: "Merge the export fixes" })]), "direct_push");
  assert.equal(kind([commit("m", MERGE)]), "local_merge");
  assert.equal(kind([commit("a")], UNASKED, { forced: true }), "rewrite");
  assert.equal(kind([], UNASKED, { forced: true }), "rewind");
  assert.equal(kind([], UNASKED, { deleted: true }), "branch_deleted");
});

test("classifyPush reads the committer the webhook names", () => {
  // Guards the seam: a renamed field in the mapper would make every button a direct push.
  const received = normalizePush({
    ref: "refs/heads/main",
    after: "c".repeat(40),
    commits: [{ id: "c".repeat(40), message: "Add invoice export (#42)", committer: { username: GITHUB_UI_COMMITTER } }],
  });

  assert.equal(classifyPush({ push: received, pull: { status: "unknown" } }), "unknown");
});

test("landedUnreviewed: what no review saw — the direct push, the laptop's merge, the pencil, the rewrite", () => {
  assert.deepEqual(
    (["pr_landing", "branch_update", "local_merge", "web_edit", "direct_push", "rewrite", "rewind", "branch_deleted", "unknown"] as const).filter(landedUnreviewed),
    ["local_merge", "web_edit", "direct_push", "rewrite"],
  );
});

test("judgedShas: a squash of a branch on record is that branch's work again; a merge-style landing is not", () => {
  const squash = push([commit("q", GITHUB)]);
  const merge = push([commit("s"), commit("m", { ...GITHUB, ...MERGE })]);
  const known = new Set(["s6"]);

  assert.deepEqual([...judgedShas({ push: squash, pull: LANDED, knownShas: known })].sort(), ["q", "s6"]);
  assert.deepEqual([...judgedShas({ push: merge, pull: LANDED, knownShas: known })], ["s6"], "its merge commit is its own work");
  assert.deepEqual([...judgedShas({ push: squash, pull: LANDED, knownShas: new Set() })], [], "a branch never on record is new work");
});
