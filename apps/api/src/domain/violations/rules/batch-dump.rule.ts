import type { ThresholdRuleConfig } from "@commander/shared";
import { landedUnreviewed } from "@/domain/judgement/event.js";
import type { RuleEvaluator } from "../types.js";

/**
 * New commits, not delivered ones. A merge re-presents every commit of the
 * branch it closes, and charging a batch dump for work already reported when
 * that branch was pushed is the same event judged twice. And only when no
 * review saw them: a pull request's commits were its branch's business.
 */
export const batchDumpRule: RuleEvaluator<ThresholdRuleConfig> = ({ kind, weight }, config) => {
  if (!landedUnreviewed(kind)) return null;
  const count = weight.newCommits;
  return count > config.threshold ? { count, threshold: config.threshold } : null;
};
