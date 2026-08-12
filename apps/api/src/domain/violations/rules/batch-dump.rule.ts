import type { ThresholdRuleConfig } from "@commander/shared";
import type { RuleEvaluator } from "../types.js";

/**
 * New commits, not delivered ones. A merge re-presents every commit of the
 * branch it closes, and charging a batch dump for work already reported when
 * that branch was pushed is the same event judged twice.
 */
export const batchDumpRule: RuleEvaluator<ThresholdRuleConfig> = ({ weight }, config) => {
  const count = weight.newCommits;
  return count > config.threshold ? { count, threshold: config.threshold } : null;
};
