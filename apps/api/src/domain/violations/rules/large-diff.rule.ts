import type { ThresholdRuleConfig } from "@commander/shared";
import { landedUnreviewed } from "@/domain/judgement/event.js";
import type { RuleEvaluator } from "../types.js";

/**
 * Counts what the push *brought*, not what it carries.
 *
 * `weight.filesTouched` excludes commits this repository already recorded,
 * counts each file once however many commits touched it, and charges a merge
 * only for its residue. Summing `push.commits` instead made a
 * PR merge the largest event in a repository's history every single time — the
 * branch's own files, counted once in its commits and again in the merge
 * commit's aggregate on top. And only when no review saw them — a pull
 * request's size was its reviewers' to weigh.
 */
export const largeDiffRule: RuleEvaluator<ThresholdRuleConfig> = ({ kind, weight }, config) => {
  if (!landedUnreviewed(kind)) return null;
  const count = weight.filesTouched;
  // Not counted: a merge could not be told from work, and guessing charges others' files.
  if (count === null) return null;
  return count > config.threshold ? { count, threshold: config.threshold } : null;
};
