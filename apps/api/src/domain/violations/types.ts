/**
 * Rule contract. Everything in `rules/` is a pure function of this shape:
 * no I/O, no Prisma, no Express (CONSTITUTION.md §2), which is what makes the
 * engine testable without a database or a server.
 */

import type { NormalizedPush, RuleDetail } from "@commander/shared";

export interface RuleContext {
  push: NormalizedPush;
  /** Fixed UTC offset from settings. Used by the time-based rules. */
  timezoneOffset: number;
}

/**
 * Returns the interpolation values for the rule's localized label when the rule
 * fires, or null when it does not. A rule never returns text.
 */
export type RuleEvaluator<TConfig> = (context: RuleContext, config: TConfig) => RuleDetail | null;

/** Shared empty hit, for rules whose label takes no interpolation. */
export const HIT: RuleDetail = {};
