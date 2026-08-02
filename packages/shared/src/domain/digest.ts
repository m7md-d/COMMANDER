/**
 * The weekly harvest, as facts.
 *
 * Everything here is counted from the ledger before a model sees it. That order
 * is not incidental: the communiqué's whole claim to being an audit rather than
 * a performance is that its numbers were measured and can be recounted. A model
 * asked to summarise a week without them will produce a paragraph that reads
 * exactly as well and means nothing.
 */

import type { ViolationId } from "./violations.js";
import type { CheckMetric } from "./checks.js";

export interface MemberWeek {
  login: string;
  displayName: string;
  pushes: number;
  commits: number;
  violations: number;
  /** Credits earned in the window — a limit crossed back the right way. Kept
   *  apart from `delta` because a credit does not cancel a charge. */
  commendations: number;
  /**
   * This week's violation count minus last week's.
   *
   * The sign is the story — who is climbing out and who is sliding — and it is
   * the one number a weekly report can give that a per-push report never can.
   */
  delta: number;
}

/** The state of the code itself, as distinct from what people did to it. */
export interface CodeState {
  metric: CheckMetric;
  /** Measured files currently over this limit. */
  over: number;
  /** How that compares with the last digest. Null on the first one, because
   *  "no change" and "nothing to compare against" are different facts. */
  change: number | null;
}

export interface DigestFacts {
  since: string;
  until: string;
  pushes: number;
  commits: number;
  violations: number;
  /** Credits earned across the window, by anyone. */
  commendations: number;
  /** Counts per violation id, worst first. */
  byRule: { ruleId: ViolationId; count: number }[];
  /** Everyone who pushed in the window, busiest first. */
  members: MemberWeek[];
  code: CodeState[];
  /** True when nothing at all happened — no pushes, no violations, no credits.
   *  A week of silence is a fact, and reporting it as an empty scoreboard is
   *  honest; inventing activity to fill it is not. */
  quiet: boolean;
}

/**
 * Who moved, and which way.
 *
 * Improvement first and regression last, each ranked by how far. Ties broken by
 * login so two identical weeks do not shuffle the roster between sends — a
 * report that reorders itself for no reason teaches people to distrust it.
 */
export function rankMovers(members: MemberWeek[]): { improved: MemberWeek[]; slipped: MemberWeek[] } {
  const byDelta = (direction: number) => (a: MemberWeek, b: MemberWeek) =>
    direction * (a.delta - b.delta) || (a.login < b.login ? -1 : 1);

  return {
    improved: members.filter((member) => member.delta < 0).sort(byDelta(1)),
    slipped: members.filter((member) => member.delta > 0).sort(byDelta(-1)),
  };
}
