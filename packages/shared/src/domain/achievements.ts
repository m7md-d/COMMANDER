/**
 * The medals and marks a member has earned, derived purely from their record.
 *
 * Two registers: **commendations** for standing worth praising, **reprimands**
 * for the patterns worth mocking — the report's carrot and stick, kept as a
 * history. Everything here is deterministic and decay-free on purpose: a badge
 * records that something *happened*, not a score that fades. The live, decaying
 * risk score lives in scoreDossier and is a different question.
 */

import type { RuleId } from "./violations.js";
import type { ToleranceTier } from "./dossier-constants.js";

export type AchievementKind = "commendation" | "reprimand";
export type AchievementGrade = "bronze" | "silver" | "gold";

/** The closed set of medals. A union (not string) so the i18n keys type-check. */
export type AchievementId =
  | "spotless"
  | "clean_streak"
  | "redeemed"
  | "prolific"
  | "first_blood"
  | "repeat_offender"
  | "on_probation"
  | "cowboy"
  | "night_owl"
  | "dumper";

export interface Achievement {
  /** Stable slug; also the i18n key suffix: `achv.<id>.name` / `achv.<id>.note`. */
  id: AchievementId;
  kind: AchievementKind;
  grade: AchievementGrade;
  /** Interpolated into the note; omitted when the badge needs no number. */
  value?: number;
}

/** The subset of a dossier an achievement can be earned from. */
export interface AchievementFacts {
  tier: ToleranceTier;
  cleanStreakDays: number;
  totalCommits: number;
  totalPushes: number;
  totalViolations: number;
  /** Lifetime raw count per rule — unlike the score, this never decays. */
  ruleCounts: Partial<Record<RuleId, number>>;
}

const PROBATION_TIERS = new Set<ToleranceTier>(["probation", "court_martial"]);
const REDEEMED_TIERS = new Set<ToleranceTier>(["exemplary", "commended"]);

/** The three cut-offs a value is measured against, named because `(3, 10, 25)`
 *  at a call site says nothing about which number is the gold one. */
interface Tiers {
  bronze: number;
  silver: number;
  gold: number;
}

/** Highest threshold a value clears, as a medal grade; null if below bronze. */
function gradeFor(value: number, tiers: Tiers): AchievementGrade | null {
  if (value >= tiers.gold) return "gold";
  if (value >= tiers.silver) return "silver";
  if (value >= tiers.bronze) return "bronze";
  return null;
}

export function computeAchievements(facts: AchievementFacts): Achievement[] {
  const out: Achievement[] = [];
  const count = (rule: RuleId): number => facts.ruleCounts[rule] ?? 0;
  const commend = (id: AchievementId, grade: AchievementGrade, value?: number): void => {
    out.push({ id, kind: "commendation", grade, value });
  };
  const reprimand = (id: AchievementId, grade: AchievementGrade, value?: number): void => {
    out.push({ id, kind: "reprimand", grade, value });
  };

  // ---- commendations: praise ----
  if (facts.totalViolations === 0 && facts.totalCommits > 0) {
    commend("spotless", "gold", facts.totalCommits);
  }

  // A streak only means something against a record: days since the last mark.
  const streak = gradeFor(facts.cleanStreakDays, { bronze: 7, silver: 30, gold: 90 });
  if (streak && facts.totalViolations > 0) {
    commend("clean_streak", streak, Math.floor(facts.cleanStreakDays));
  }

  if (facts.totalViolations > 0 && REDEEMED_TIERS.has(facts.tier) && facts.cleanStreakDays >= 14) {
    commend("redeemed", "silver");
  }

  const prolific = gradeFor(facts.totalCommits, { bronze: 50, silver: 200, gold: 500 });
  if (prolific) commend("prolific", prolific, facts.totalCommits);

  // ---- reprimands: mockery ----
  if (facts.totalViolations >= 1) reprimand("first_blood", "bronze");

  const repeat = gradeFor(facts.totalViolations, { bronze: 5, silver: 15, gold: 40 });
  if (repeat) reprimand("repeat_offender", repeat, facts.totalViolations);

  if (PROBATION_TIERS.has(facts.tier)) reprimand("on_probation", "gold");

  // Signature offences: the rule that defines the offender's style.
  const signatures: [AchievementId, RuleId][] = [
    ["cowboy", "direct_push"],
    ["night_owl", "night_ops"],
    ["dumper", "batch_dump"],
  ];
  for (const [id, rule] of signatures) {
    const tally = count(rule);
    const g = gradeFor(tally, { bronze: 3, silver: 10, gold: 25 });
    if (g) reprimand(id, g, tally);
  }

  return out;
}
