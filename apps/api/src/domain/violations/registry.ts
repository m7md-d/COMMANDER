/**
 * The one place that knows every rule exists.
 *
 * `Registry` is typed against RuleConfigMap, so adding a RuleId in the shared
 * package without adding its evaluator here is a compile error — the recipe in
 * CONSTITUTION.md §8 is enforced by the type system, not by discipline.
 */

import type { RuleConfigMap, RuleId } from "@commander/shared";
import type { RuleEvaluator } from "./types.js";

import { forcePushRule } from "./rules/force-push.rule.js";
import { batchDumpRule } from "./rules/batch-dump.rule.js";
import { directPushRule } from "./rules/direct-push.rule.js";
import { lazyMessageRule } from "./rules/lazy-message.rule.js";
import { nightOpsRule } from "./rules/night-ops.rule.js";
import { weekendOpsRule } from "./rules/weekend-ops.rule.js";
import { largeDiffRule } from "./rules/large-diff.rule.js";
import { branchDeletedRule } from "./rules/branch-deleted.rule.js";
import { mergeResidueRule } from "./rules/merge-residue.rule.js";
import { landedUnfixedRule } from "./rules/landed-unfixed.rule.js";

type Registry = { [K in RuleId]: RuleEvaluator<RuleConfigMap[K]> };

export const RULE_REGISTRY: Registry = {
  force_push: forcePushRule,
  batch_dump: batchDumpRule,
  direct_push: directPushRule,
  lazy_message: lazyMessageRule,
  night_ops: nightOpsRule,
  weekend_ops: weekendOpsRule,
  large_diff: largeDiffRule,
  branch_deleted: branchDeletedRule,
  merge_residue: mergeResidueRule,
  landed_unfixed: landedUnfixedRule,
};

/**
 * Who answers for what a rule finds (0009 §4): whoever pushed, for what the
 * push did — landed on a branch unreviewed, rewrote it, deleted it, dumped a
 * heap at once; the author, for what a commit holds — its message, its hour,
 * what a merge slipped in beside the work it carries. Written out per rule like
 * the registry, so a new rule cannot compile without an answer.
 *
 * `merge_residue` is the author's, where 0009 listed it with the pusher's acts:
 * a merge commit's author is the one who made the merge, and the pusher of
 * someone else's merge would otherwise answer for what they never wrote.
 *
 * The two are partners, not alternatives: a crossing someone else wrote is
 * charged to its author, and landing it on a main line unfixed is charged to
 * whoever landed it — `landed_unfixed`, the pusher's share.
 */
export type Answerer = "pusher" | "author";

export const RULE_ANSWERER: { [K in RuleId]: Answerer } = {
  force_push: "pusher",
  batch_dump: "pusher",
  direct_push: "pusher",
  lazy_message: "author",
  night_ops: "author",
  weekend_ops: "author",
  large_diff: "pusher",
  branch_deleted: "pusher",
  merge_residue: "author",
  landed_unfixed: "pusher",
};
