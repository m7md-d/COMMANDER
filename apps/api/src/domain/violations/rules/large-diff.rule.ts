import type { ThresholdRuleConfig } from "@commander/shared";
import type { RuleEvaluator } from "../types.js";

/**
 * Counts what the push *brought*, not what it carries.
 *
 * `weight.filesTouched` excludes commits this repository already recorded and
 * charges a merge only for its residue. Summing `push.commits` instead made a
 * PR merge the largest event in a repository's history every single time — the
 * branch's own files, counted once in its commits and again in the merge
 * commit's aggregate on top.
 */
export const largeDiffRule: RuleEvaluator<ThresholdRuleConfig> = ({ weight }, config) => {
  const count = weight.filesTouched;
  return count > config.threshold ? { count, threshold: config.threshold } : null;
};
