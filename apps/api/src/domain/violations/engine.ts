/**
 * Evaluates the enabled rules for one push. Pure: no I/O, no logging of user
 * data, no dependency on Express or Prisma (CONSTITUTION.md §2).
 */

import {
  RULE_IDS,
  defaultRuleConfig,
  type RuleConfigMap,
  type RuleId,
  type ViolationHit,
} from "@commander/shared";
import { RULE_REGISTRY } from "./registry.js";
import type { RuleContext } from "./types.js";

/**
 * A stored rules document may predate a newly added rule, so every lookup falls
 * back to the shipped default rather than crashing on an absent key.
 */
export function mergeWithDefaults(stored: unknown): RuleConfigMap {
  const defaults = defaultRuleConfig();
  if (typeof stored !== "object" || stored === null) return defaults;

  const source = stored as Record<string, unknown>;

  /*
   * Written out key by key rather than looped. A loop would need `merged[id]`
   * with `id` widened to the RuleId union, which TypeScript requires to satisfy
   * the intersection of every rule config — no value does, so it forces a cast.
   * Listing the keys keeps it cast-free AND makes adding a RuleId a compile
   * error right here, which is exactly the reminder we want.
   */
  const overlay = <K extends RuleId>(id: K): RuleConfigMap[K] => {
    const entry = source[id];
    if (typeof entry !== "object" || entry === null) return defaults[id];
    return { ...defaults[id], ...(entry as Partial<RuleConfigMap[K]>) };
  };

  return {
    force_push: overlay("force_push"),
    batch_dump: overlay("batch_dump"),
    direct_push: overlay("direct_push"),
    lazy_message: overlay("lazy_message"),
    night_ops: overlay("night_ops"),
    weekend_ops: overlay("weekend_ops"),
    large_diff: overlay("large_diff"),
    branch_deleted: overlay("branch_deleted"),
  };
}

/**
 * Reported when a rule throws. The domain layer stays pure (§2) and cannot log,
 * so the caller injects this and decides what to do — swallowing it here would
 * violate §6.
 */
export type RuleErrorReporter = (ruleId: RuleId, error: unknown) => void;

export function evaluateRules(
  context: RuleContext,
  rules: RuleConfigMap,
  onRuleError: RuleErrorReporter,
): ViolationHit[] {
  const hits: ViolationHit[] = [];

  for (const ruleId of RULE_IDS) {
    const config = rules[ruleId];
    if (!config.enabled) continue;

    const detail = runRule({ ruleId, context, config, onRuleError });
    if (detail !== null) hits.push({ ruleId, detail });
  }

  return hits;
}

/**
 * One broken rule must not silence every report for a repository, so a throw is
 * contained — but it is always surfaced through the reporter, never dropped.
 */
function runRule<K extends RuleId>(input: {
  ruleId: K;
  context: RuleContext;
  config: RuleConfigMap[K];
  onRuleError: RuleErrorReporter;
}): ViolationHit["detail"] | null {
  const { ruleId, context, config, onRuleError } = input;
  const evaluator = RULE_REGISTRY[ruleId] as (
    context: RuleContext,
    config: RuleConfigMap[K],
  ) => ViolationHit["detail"] | null;

  try {
    return evaluator(context, config);
  } catch (error) {
    onRuleError(ruleId, error);
    return null;
  }
}
