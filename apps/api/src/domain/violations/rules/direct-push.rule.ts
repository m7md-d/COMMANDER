import type { RuleConfigBase } from "@commander/shared";
import { landedUnreviewed } from "@/domain/judgement/event.js";
import type { RuleEvaluator } from "../types.js";

/**
 * Fires when work landed on the branch without passing through a pull request:
 * commits pushed from a laptop, a merge made on one, the pencil in the browser,
 * a rewrite. Decided by the event (`classifyPush`), never by a title — squash
 * and rebase merges carry ordinary titles, and "Merge…" is typed by anyone.
 */
export const directPushRule: RuleEvaluator<RuleConfigBase> = ({ kind, push }) =>
  landedUnreviewed(kind) ? { count: push.commits.length } : null;
