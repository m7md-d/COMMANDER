/**
 * The direct-push rule is the one most easily broken by a "simplification".
 * It once matched a `Merge ...` title, which squash and rebase merges do not
 * have and any commit can imitate; then it trusted GitHub's `web-flow`
 * committer, which the pencil in the browser carries too. It now reads the
 * event (`classifyPush`), and these pin which events are landings of work no
 * review saw.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { NormalizedCommit, NormalizedPush, PushWeight, RuleConfigBase } from "@commander/shared";
import { PUSH_KINDS, type PushKind } from "@/domain/judgement/event.js";
import { directPushRule } from "@/domain/violations/rules/direct-push.rule.js";

const ENABLED: RuleConfigBase = { enabled: true };

function commit(sha: string): NormalizedCommit {
  return {
    sha,
    title: "fix: correct the tax rounding",
    url: "",
    timestamp: "2026-07-01T12:00:00Z",
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: 1,
    authorLogin: "ahmad-gh",
    committerLogin: "ahmad-gh",
  };
}

const PUSH: NormalizedPush = {
  repoFullName: "team/repo",
  repoUrl: "",
  branch: "main",
  ref: "refs/heads/main",
  forced: false,
  created: false,
  deleted: false,
  compareUrl: "",
  actorLogin: "ahmad-gh",
  actorAvatarUrl: "",
  commits: [commit("a"), commit("b")],
  truncated: false,
};

/** This rule reads the event, not the weight. */
const UNWEIGHED: PushWeight = { newCommits: 0, filesTouched: 0, work: [], measured: false };

const evaluate = (kind: PushKind) =>
  directPushRule({ push: PUSH, kind, trunk: true, timezoneOffset: 3, weight: UNWEIGHED, commits: PUSH.commits, landed: [] }, ENABLED);

test("work that landed with no pull request is a direct push, however it was made", () => {
  for (const kind of ["direct_push", "local_merge", "web_edit", "rewrite"] as const) {
    assert.deepEqual(evaluate(kind), { count: 2 }, kind);
  }
});

test("a landing, an update from the base, and what cannot be told are not", () => {
  const unreviewed = new Set<PushKind>(["direct_push", "local_merge", "web_edit", "rewrite"]);
  for (const kind of PUSH_KINDS.filter((each) => !unreviewed.has(each))) {
    assert.equal(evaluate(kind), null, kind);
  }
});
