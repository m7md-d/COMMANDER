/**
 * The engine's two promises: a disabled rule never runs, and a rule that throws
 * is reported rather than raised — one broken rule must not silence every
 * report for a repository.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { NormalizedCommit, NormalizedPush, PushWeight, RuleId } from "@commander/shared";
import { evaluateRules, mergeWithDefaults } from "./engine.js";

const UNWEIGHED: PushWeight = { newCommits: 0, filesTouched: 0, residue: [], paths: [], measured: false };

/**
 * A forced deletion whose commits cannot be read. Every rule that reads the
 * commits throws; `force_push` and `branch_deleted` read only the flags, and the
 * second of them runs after the throwers.
 */
const UNREADABLE: NormalizedPush = {
  repoFullName: "team/repo",
  repoUrl: "",
  branch: "main",
  ref: "refs/heads/main",
  forced: true,
  created: false,
  deleted: true,
  compareUrl: "",
  actorLogin: "sara",
  actorAvatarUrl: "",
  truncated: false,
  get commits(): NormalizedCommit[] {
    throw new Error("unreadable");
  },
};

function evaluate(stored: unknown) {
  const thrown: RuleId[] = [];
  const hits = evaluateRules(
    { push: UNREADABLE, timezoneOffset: 3, weight: UNWEIGHED },
    mergeWithDefaults(stored),
    (ruleId) => {
      thrown.push(ruleId);
    },
  );
  return { hits: hits.map((hit) => hit.ruleId), thrown: thrown.sort() };
}

test("a rule that throws is reported, and the rules after it still run", () => {
  const { hits, thrown } = evaluate({});

  assert.deepEqual(thrown, ["direct_push", "lazy_message", "night_ops"]);
  assert.deepEqual(hits, ["force_push", "branch_deleted"]);
});

test("a disabled rule never runs, so it can neither charge nor throw", () => {
  const off = { enabled: false };
  const { hits, thrown } = evaluate({
    force_push: off,
    batch_dump: off,
    direct_push: off,
    lazy_message: off,
    night_ops: off,
    branch_deleted: off,
    merge_residue: off,
  });

  assert.deepEqual(hits, []);
  assert.deepEqual(thrown, []);
});
