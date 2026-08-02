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
};
