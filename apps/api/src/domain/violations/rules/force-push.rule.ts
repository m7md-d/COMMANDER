import type { RuleConfigBase } from "@commander/shared";
import { HIT, type RuleEvaluator } from "../types.js";

/** GitHub sets `forced` when the ref moved non-fast-forward. */
export const forcePushRule: RuleEvaluator<RuleConfigBase> = ({ push }) =>
  push.forced ? HIT : null;
