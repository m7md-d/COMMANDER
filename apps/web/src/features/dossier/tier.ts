import type { ToleranceTier } from "@commander/shared";

/**
 * Tier → badge tone. Kept out of the components so the roster and the open
 * dossier can never disagree about what "probation" looks like.
 *
 * `accent` is deliberately absent: the brass tone marks the active navigation
 * item, and spending it on a data state would blunt it (web constitution §2).
 */
const TONE: Record<ToleranceTier, "success" | "neutral" | "info" | "danger"> = {
  exemplary: "success",
  commended: "success",
  standard: "neutral",
  watch: "info",
  probation: "danger",
  court_martial: "danger",
};

export function tierTone(tier: ToleranceTier): "success" | "neutral" | "info" | "danger" {
  return TONE[tier];
}

/** Scores are compared by eye, not audited — one decimal is the useful precision. */
export function roundScore(score: number): number {
  return Math.round(score * 10) / 10;
}
