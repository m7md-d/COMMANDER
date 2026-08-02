import { totalFilesTouched, type ThresholdRuleConfig } from "@commander/shared";
import type { RuleEvaluator } from "../types.js";

export const largeDiffRule: RuleEvaluator<ThresholdRuleConfig> = ({ push }, config) => {
  const count = totalFilesTouched(push.commits);
  return count > config.threshold ? { count, threshold: config.threshold } : null;
};
