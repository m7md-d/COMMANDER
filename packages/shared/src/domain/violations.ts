/**
 * Violation rule identity, shared by the engine that evaluates rules and the
 * panel that configures them.
 *
 * Adding a rule starts here: extend RULE_IDS, add its config shape, then follow
 * CONSTITUTION.md §8. TypeScript will point at every place that must change.
 */

import type { CheckMetric } from "./checks.js";

export const RULE_IDS = [
  "force_push",
  "batch_dump",
  "direct_push",
  "lazy_message",
  "night_ops",
  "weekend_ops",
  "large_diff",
  "branch_deleted",
] as const;

export type RuleId = (typeof RULE_IDS)[number];

/**
 * Anything that can be charged to a member: an engagement rule, or a check
 * metric crossed (see checks.ts).
 *
 * One id space, deliberately, because it is one record. The dossier, the repeat
 * bands and the statistics all read `ledger_events`, and splitting a person's
 * history by which mechanism happened to catch them would mean teaching every
 * one of those readers about a second source. The two id sets are kept disjoint
 * by a guard rather than by a prefix, so the label keys stay `rule.<id>.*` and
 * every existing reader keeps working untouched.
 */
export type ViolationId = RuleId | CheckMetric;

/** Numbers interpolated into the localized label. Never prose. */
export type RuleDetail = Record<string, string | number>;

export interface ViolationHit {
  ruleId: ViolationId;
  detail: RuleDetail;
}

/*
 * Type aliases rather than interfaces, deliberately: only aliases receive an
 * implicit index signature, which lets the panel read a rule's optional fields
 * generically (`config["threshold"]`) without a cast. An interface here would
 * force `as unknown as`, which the constitution forbids.
 */
export type RuleConfigBase = {
  enabled: boolean;
};

export type ThresholdRuleConfig = RuleConfigBase & {
  threshold: number;
};

export type LazyMessageRuleConfig = RuleConfigBase & {
  minLength: number;
  words: string[];
};

export type TimeWindowRuleConfig = RuleConfigBase & {
  startHour: number;
  endHour: number;
};

export type WeekdayRuleConfig = RuleConfigBase & {
  days: number[];
};

export interface RuleConfigMap {
  force_push: RuleConfigBase;
  batch_dump: ThresholdRuleConfig;
  direct_push: RuleConfigBase;
  lazy_message: LazyMessageRuleConfig;
  night_ops: TimeWindowRuleConfig;
  weekend_ops: WeekdayRuleConfig;
  large_diff: ThresholdRuleConfig;
  branch_deleted: RuleConfigBase;
}

export type RuleConfig = RuleConfigMap[RuleId];

export const DEFAULT_LAZY_WORDS = [
  "fix",
  "wip",
  "update",
  "test",
  "asdf",
  "commit",
  "done",
  "changes",
  "stuff",
  "temp",
  "final",
  ".",
] as const;

export function defaultRuleConfig(): RuleConfigMap {
  return {
    force_push: { enabled: true },
    batch_dump: { enabled: true, threshold: 5 },
    direct_push: { enabled: true },
    lazy_message: { enabled: true, minLength: 8, words: [...DEFAULT_LAZY_WORDS] },
    night_ops: { enabled: true, startHour: 1, endHour: 5 },
    weekend_ops: { enabled: false, days: [5, 6] },
    large_diff: { enabled: false, threshold: 40 },
    branch_deleted: { enabled: true },
  };
}
