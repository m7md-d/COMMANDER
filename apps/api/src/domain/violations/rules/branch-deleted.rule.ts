import type { RuleConfigBase } from "@commander/shared";
import type { RuleEvaluator } from "../types.js";

/** A deletion carries no commits, so it is the one rule that fires on an empty push. */
export const branchDeletedRule: RuleEvaluator<RuleConfigBase> = ({ push }) =>
  push.deleted ? { branch: push.branch } : null;
