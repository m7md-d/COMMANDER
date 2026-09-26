/**
 * Rule contract. Everything in `rules/` is a pure function of this shape:
 * no I/O, no Prisma, no Express (CONSTITUTION.md §2), which is what makes the
 * engine testable without a database or a server.
 */

import type { Finding, NormalizedCommit, NormalizedPush, PushWeight, RuleDetail } from "@commander/shared";
import type { PushKind } from "@/domain/judgement/event.js";

export interface RuleContext {
  push: NormalizedPush;
  /** What happened (`classifyPush`): the rules judge the event, not the list of commits. */
  kind: PushKind;
  /** Whether the push is on a main line (`isTrunk`), where the rules about landing work apply. */
  trunk: boolean;
  /** Fixed UTC offset from settings. Used by the time-based rules. */
  timezoneOffset: number;
  /**
   * What the push actually brought, as opposed to what it carries — computed
   * once by the caller because it needs the repository's known shas, which the
   * domain may not read. The size rules judge this rather than `push.commits`,
   * so a merge is not charged for the branch it closes (see weighPush).
   */
  weight: PushWeight;
  /**
   * The commits under judgement. For a rule the author answers for, one
   * author's commits the record has not judged yet — so a commit is judged once,
   * when it first arrives, and against whoever wrote it. For a rule the pusher
   * answers for, every commit the push carries.
   */
  commits: NormalizedCommit[];
  /**
   * Crossings the push left standing on a main line from work that was not the
   * pusher's own new work — a branch reported before, or someone else's commits.
   * What `landed_unfixed` charges the pusher with. Empty off a main line, and in
   * the authors' pass.
   */
  landed: Finding[];
}

/**
 * Returns the interpolation values for the rule's localized label when the rule
 * fires, or null when it does not. A rule never returns text.
 */
export type RuleEvaluator<TConfig> = (context: RuleContext, config: TConfig) => RuleDetail | null;

/** Shared empty hit, for rules whose label takes no interpolation. */
export const HIT: RuleDetail = {};
