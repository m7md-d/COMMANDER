/**
 * The dossier scoring model.
 *
 * Design premise: a record that only accumulates is a record that rots. Someone
 * who had one bad week in March must not still be "on probation" in December,
 * and someone drifting badly right now must not be hidden behind a year of
 * good history. So the score is a function of *when* things happened, not just
 * how many.
 *
 * Three mechanisms, in order of importance:
 *   1. Exponential decay  — every event's weight halves every HALF_LIFE_DAYS.
 *   2. Burst discount     — a cluster that never repeated is treated as an
 *                           anomaly and discounted, not as a pattern.
 *   3. Redemption         — a sustained clean streak actively pulls the score
 *                           down rather than merely stopping its rise.
 *
 * Everything here is pure and deterministic. The narrative layer never invents
 * numbers; it only describes what this file computed.
 */

import type { ViolationId } from "./violations.js";
import {
  BURST_DISCOUNT,
  HALF_LIFE_DAYS,
  RULE_SEVERITY,
  type ScoredEvent,
  type ToleranceTier,
  type ViolationEventInput,
} from "./dossier-constants.js";
import { findAnomalies } from "./dossier-anomaly.js";

export * from "./dossier-constants.js";

/** Upper bound of each tier's decayed-score band. */
const TIER_THRESHOLDS: { tier: ToleranceTier; max: number }[] = [
  { tier: "exemplary", max: 0.5 },
  { tier: "commended", max: 2 },
  { tier: "standard", max: 6 },
  { tier: "watch", max: 12 },
  { tier: "probation", max: 24 },
  { tier: "court_martial", max: Number.POSITIVE_INFINITY },
];

export interface DossierScore {
  riskScore: number;
  tier: ToleranceTier;
  events: ScoredEvent[];
  /** Per-rule decayed contribution, for the panel's breakdown. */
  byRule: Partial<Record<ViolationId, number>>;
  anomalyCount: number;
  redemptionCredit: number;
  cleanStreakDays: number;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 86_400_000);
}

/** w(t) = 0.5 ^ (age / halfLife) */
export function decayFactor(ageDays: number, halfLifeDays = HALF_LIFE_DAYS): number {
  return 0.5 ** (ageDays / halfLifeDays);
}

const REDEMPTION_PER_CLEAN_DAY = 0.02;
const MAX_REDEMPTION = 4;

/**
 * A clean streak should actively repair standing, not merely stop the damage.
 * Capped so it can never fully erase a severe recent record.
 */
export function redemptionCredit(cleanStreakDays: number): number {
  return Math.min(MAX_REDEMPTION, cleanStreakDays * REDEMPTION_PER_CLEAN_DAY);
}

export function tierForScore(score: number): ToleranceTier {
  for (const { tier, max } of TIER_THRESHOLDS) {
    if (score < max) return tier;
  }
  return "court_martial";
}

export function scoreDossier(
  events: ViolationEventInput[],
  options: { now?: Date; halfLifeDays?: number } = {},
): DossierScore {
  const now = options.now ?? new Date();
  const halfLife = options.halfLifeDays ?? HALF_LIFE_DAYS;
  const anomalies = findAnomalies(events, now);

  const scored: ScoredEvent[] = events.map((event, index) => {
    const ageDays = daysBetween(new Date(event.occurredAt), now);
    const isAnomaly = anomalies.has(index);
    const weight =
      (RULE_SEVERITY[event.ruleId] ?? 1) *
      decayFactor(ageDays, halfLife) *
      (isAnomaly ? BURST_DISCOUNT : 1);

    return { ruleId: event.ruleId, occurredAt: event.occurredAt, ageDays, weight, discountedAsAnomaly: isAnomaly };
  });

  const byRule: Partial<Record<ViolationId, number>> = {};
  for (const event of scored) {
    byRule[event.ruleId] = (byRule[event.ruleId] ?? 0) + event.weight;
  }

  const lastEvent = scored.reduce<number | null>(
    (min, event) => (min === null || event.ageDays < min ? event.ageDays : min),
    null,
  );
  const cleanStreakDays = lastEvent ?? 0;
  const credit = events.length > 0 ? redemptionCredit(cleanStreakDays) : 0;

  const raw = scored.reduce((sum, event) => sum + event.weight, 0);
  const riskScore = Math.max(0, raw - credit);

  return {
    riskScore,
    tier: tierForScore(riskScore),
    events: scored,
    byRule,
    anomalyCount: anomalies.size,
    redemptionCredit: credit,
    cleanStreakDays,
  };
}

/**
 * Stable fingerprint of the facts a narrative was written from.
 *
 * The narrative is regenerated only when this changes, which is what stops the
 * model being called on every push and what stops the prose drifting away from
 * the numbers it claims to describe.
 */
export function factsFingerprint(input: {
  tier: ToleranceTier;
  riskScore: number;
  totalCommits: number;
  totalPushes: number;
  topFiles: string[];
}): string {
  // Score is bucketed: tiny fluctuations must not trigger a rewrite.
  const bucket = Math.round(input.riskScore * 2) / 2;
  return [
    input.tier,
    bucket.toFixed(1),
    input.totalCommits,
    input.totalPushes,
    input.topFiles.slice(0, 5).join("|"),
  ].join("::");
}
