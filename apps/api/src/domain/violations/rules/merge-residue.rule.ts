import { isMerge, type RuleConfigBase } from "@commander/shared";
import type { RuleEvaluator } from "../types.js";

/**
 * A merge that introduced files belonging to no commit it brings in.
 *
 * This is the one thing a large merge can hide: the size of the diff is the
 * cover, and lines added by the merge itself sit in it unremarked because every
 * reviewer reads the merge as "the branch I already approved".
 *
 * Silent by construction rather than by tuning. A clean merge leaves nothing —
 * it transports files its commits already contain. A conflicted file is present
 * in the branch, so by path it is carried, not residue; what the resolution
 * itself wrote is read line by line instead (`resolved`), and a resolution that
 * only takes each side's lines leaves nothing there either.
 *
 * Reports the count alone. The paths are attacker-controlled text and a
 * violation label is interpolated straight into the model's prompt, so a path
 * here would be an injection route through a rule that exists to catch bad
 * faith. Whoever reads the finding has the merge in front of them.
 */
export const mergeResidueRule: RuleEvaluator<RuleConfigBase> = ({ weight, commits, resolved }) => {
  // Never on an unmeasured push: a truncated payload or a missing branch head
  // makes an honest merge look like it wrote the whole branch by itself.
  if (!weight.measured) return null;

  // The merges under judgement are one author's, so the residue is theirs alone.
  const merges = new Set(commits.filter(isMerge).map((commit) => commit.sha));
  const residue = new Set(weight.work.filter((entry) => merges.has(entry.sha)).flatMap((entry) => entry.paths));
  // And what the landing merge wrote inside a file both sides changed (D-25).
  if (resolved && merges.has(resolved.merge)) for (const path of resolved.paths) residue.add(path);
  return residue.size === 0 ? null : { files: residue.size };
};
