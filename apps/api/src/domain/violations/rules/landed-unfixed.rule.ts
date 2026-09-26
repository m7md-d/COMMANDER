import type { RuleConfigBase } from "@commander/shared";
import type { RuleEvaluator } from "../types.js";

/**
 * Whoever lands work on a main line answers for what it leaves there.
 *
 * The author of a crossing is charged for writing it — once, when it is first
 * seen. Landing it on a main line without fixing it is a second act, by
 * whoever pushed: a branch whose crossing was reported and merged anyway, or
 * someone else's commits pushed unread. Partners, not alternatives — neither
 * charge replaces the other.
 *
 * Counts files rather than crossings: one landing is one act, however many
 * metrics a file broke. Off a main line nothing is landed, so pulling main into
 * a feature branch charges nobody for what main already held.
 */
export const landedUnfixedRule: RuleEvaluator<RuleConfigBase> = ({ push, landed }) => {
  const files = new Set(landed.map((finding) => String(finding.detail["path"] ?? "")));
  return files.size === 0 ? null : { files: files.size, branch: push.branch };
};
