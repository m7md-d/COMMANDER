/**
 * Burst / anomaly detection.
 *
 * Split out of dossier.ts to satisfy CONSTITUTION.md §4, and because it answers
 * a genuinely different question: dossier.ts asks "how heavy is this record",
 * this file asks "was that cluster a habit, or one bad week that ended".
 */

import { HALF_LIFE_DAYS, type ViolationEventInput } from "./dossier-constants.js";
import type { ViolationId } from "./violations.js";

const BURST_WINDOW_HOURS = 48;
const BURST_MIN_EVENTS = 3;
/** Silence this long after a burst means it was a one-off, not a habit. */
const ANOMALY_SILENCE_MULTIPLE = 2;

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Returns the indices of events belonging to a same-rule cluster that never
 * repeated.
 *
 * A burst is >= BURST_MIN_EVENTS of one rule inside BURST_WINDOW_HOURS. If that
 * rule then stays silent for ANOMALY_SILENCE_MULTIPLE half-lives, the cluster is
 * treated as history rather than a pattern. Without this, one chaotic sprint
 * outranks a year of steady discipline forever.
 *
 * Only the *last* cluster of a rule can qualify: if the rule fired again after
 * it, the behaviour recurred and by definition was not an anomaly.
 */
export function findAnomalies(events: ViolationEventInput[], now: Date): Set<number> {
  const anomalies = new Set<number>();
  const byRule = new Map<ViolationId, number[]>();

  events.forEach((event, index) => {
    const list = byRule.get(event.ruleId) ?? [];
    list.push(index);
    byRule.set(event.ruleId, list);
  });

  for (const indices of byRule.values()) {
    const sorted = [...indices].sort(
      (a, b) => Date.parse(events[a]!.occurredAt) - Date.parse(events[b]!.occurredAt),
    );

    let clusterStart = 0;

    for (let i = 1; i <= sorted.length; i++) {
      const gapBroken =
        i === sorted.length ||
        Date.parse(events[sorted[i]!]!.occurredAt) -
          Date.parse(events[sorted[i - 1]!]!.occurredAt) >
          BURST_WINDOW_HOURS * 3_600_000;

      if (!gapBroken) continue;

      const cluster = sorted.slice(clusterStart, i);
      // Advanced before the test, not after it: the next cluster starts here
      // whether or not this one qualified, and hanging that off the tail of a
      // branch is how the two get coupled by accident.
      clusterStart = i;

      const lastInCluster = events[cluster[cluster.length - 1]!]!;
      const silenceDays = daysBetween(new Date(lastInCluster.occurredAt), now);
      const isLastCluster = i === sorted.length;

      const qualifies =
        cluster.length >= BURST_MIN_EVENTS &&
        isLastCluster &&
        silenceDays > HALF_LIFE_DAYS * ANOMALY_SILENCE_MULTIPLE;
      if (!qualifies) continue;

      for (const index of cluster) anomalies.add(index);
    }
  }

  return anomalies;
}
