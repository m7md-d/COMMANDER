/**
 * The engine's three promises: a disabled rule never runs, a rule runs only for
 * the answerer it is written against, and a rule that throws is reported rather
 * than raised — one broken rule must not silence every report for a repository.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { RULE_IDS, type NormalizedCommit, type NormalizedPush, type PushWeight, type RuleId } from "@commander/shared";
import { evaluateRules, mergeWithDefaults } from "./engine.js";
import { RULE_ANSWERER, type Answerer } from "./registry.js";
import type { RuleContext } from "./types.js";

const UNWEIGHED: PushWeight = { newCommits: 0, filesTouched: 0, work: [], measured: false };

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

/** The commits under judgement cannot be read either. */
const CONTEXT: RuleContext = {
  push: UNREADABLE,
  timezoneOffset: 3,
  weight: UNWEIGHED,
  landed: [],
  get commits(): NormalizedCommit[] {
    throw new Error("unreadable");
  },
};

function evaluate(stored: unknown, answerer: Answerer) {
  const thrown: RuleId[] = [];
  const hits = evaluateRules({ context: CONTEXT, rules: mergeWithDefaults(stored), answerer }, (ruleId) => {
    thrown.push(ruleId);
  });
  return { hits: hits.map((hit) => hit.ruleId), thrown: thrown.sort() };
}

test("a rule that throws is reported, and the rules after it still run", () => {
  assert.deepEqual(evaluate({}, "pusher"), { hits: ["force_push", "branch_deleted"], thrown: ["direct_push"] });
  assert.deepEqual(evaluate({}, "author"), { hits: [], thrown: ["lazy_message", "merge_residue", "night_ops"] });
});

test("a rule runs only for the answerer it is written against", () => {
  const everyRuleOn = Object.fromEntries(RULE_IDS.map((id) => [id, { enabled: true }]));

  for (const answerer of ["pusher", "author"] as const) {
    const { hits, thrown } = evaluate(everyRuleOn, answerer);
    const ran = [...hits, ...thrown].sort();
    const own = new Set<string>(RULE_IDS.filter((id) => RULE_ANSWERER[id] === answerer));
    assert.ok(ran.every((id) => own.has(id)), `${answerer} ran ${ran.join(", ")}`);
  }
});

test("a disabled rule never runs, so it can neither charge nor throw", () => {
  const off = { enabled: false };
  const stored = {
    force_push: off,
    batch_dump: off,
    direct_push: off,
    lazy_message: off,
    night_ops: off,
    branch_deleted: off,
    merge_residue: off,
  };

  for (const answerer of ["pusher", "author"] as const) {
    assert.deepEqual(evaluate(stored, answerer), { hits: [], thrown: [] });
  }
});
