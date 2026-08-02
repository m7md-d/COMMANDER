import type { ThresholdRuleConfig } from "@commander/shared";
import type { RuleEvaluator } from "../types.js";

export const batchDumpRule: RuleEvaluator<ThresholdRuleConfig> = ({ push }, config) => {
  const count = push.commits.length;
  return count > config.threshold ? { count, threshold: config.threshold } : null;
};
