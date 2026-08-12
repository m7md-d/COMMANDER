import type { RuleConfigBase } from "@commander/shared";
import type { RuleEvaluator } from "../types.js";

/**
 * A merge that introduced files belonging to no commit it brings in.
 *
 * This is the one thing a large merge can hide: the size of the diff is the
 * cover, and lines added by the merge itself sit in it unremarked because every
 * reviewer reads the merge as "the branch I already approved".
 *
 * Silent by construction rather than by tuning. A clean merge leaves nothing —
 * it transports files its commits already contain. A conflict resolution leaves
 * nothing either, which is the property that makes this usable: a conflicted
 * file is by definition present in the branch, so it is carried, not residue.
 *
 * Reports the count alone. The paths are attacker-controlled text and a
 * violation label is interpolated straight into the model's prompt, so a path
 * here would be an injection route through a rule that exists to catch bad
 * faith. Whoever reads the finding has the merge in front of them.
 */
export const mergeResidueRule: RuleEvaluator<RuleConfigBase> = ({ weight }) => {
  // Never on an unmeasured push: a truncated payload or a missing branch head
  // makes an honest merge look like it wrote the whole branch by itself.
  if (!weight.measured || weight.residue.length === 0) return null;
  return { files: weight.residue.length };
};
