/**
 * Tunables and shared types for the dossier score. Separated so both
 * dossier.ts and dossier-anomaly.ts can import them without a cycle.
 */

import type { ViolationId } from "./violations.js";

export const HALF_LIFE_DAYS = 30;

/** Weight multiplier applied to events judged a closed anomaly. */
export const BURST_DISCOUNT = 0.4;

/**
 * Not all violations are equal. Rewriting shared history is a different class
 * of act from a terse commit message, and a flat count would rank a chronically
 * lazy writer above someone who force-pushed over a teammate's work.
 */
export const RULE_SEVERITY: Record<ViolationId, number> = {
  force_push: 3.0,
  branch_deleted: 2.5,
  direct_push: 1.5,
  large_diff: 1.2,
  batch_dump: 1.0,
  night_ops: 0.6,
  weekend_ops: 0.4,
  lazy_message: 0.8,

  // Checks sit above a terse commit message and below rewriting shared history:
  // crossing a size limit is a deliberate act with a lasting cost, but it harms
  // the code rather than a teammate's work.
  file_lines: 1.4,
  function_lines: 1.3,
  nesting_depth: 1.3,
  brace_depth: 1.2,
  // The most arguable of the three, and weighted as such: a long line is a
  // readability cost, not a structural one.
  line_length: 0.6,
};

export const TOLERANCE_TIERS = [
  "exemplary",
  "commended",
  "standard",
  "watch",
  "probation",
  "court_martial",
] as const;

export type ToleranceTier = (typeof TOLERANCE_TIERS)[number];

export interface ViolationEventInput {
  ruleId: ViolationId;
  occurredAt: string;
}

export interface ScoredEvent {
  ruleId: ViolationId;
  occurredAt: string;
  ageDays: number;
  /** severity x decay x burst discount. */
  weight: number;
  /** True when this event belongs to a cluster that never recurred. */
  discountedAsAnomaly: boolean;
}
