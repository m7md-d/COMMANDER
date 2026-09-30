/**
 * What a delivery keeps of its judgement (0012), and how it is read back.
 *
 * A push is judged once: its charges recorded, its row given this. Everything
 * after — the outbox's retry when Discord refused, the resend button, a rewrite
 * — writes and sends from what was kept, and never judges again. Judging again
 * is how a retry recorded the pusher's charges twice and told a different story
 * the second time (D-31, scenario `delivery-retried-after-discord-refused-it`).
 *
 * Pure: the writing is `report.record.ts`, so this reads in a test without a
 * database.
 */

import type { Prisma } from "@prisma/client";
import type { Commendation, DeliveryJudgement, NormalizedPush, ViolationHit } from "@commander/shared";
import { fromJson } from "@/core/json.js";
import type { Judgement } from "@/domain/judgement/judgement.js";
import type { HistoryRecord } from "@/domain/report/prompt-builder.js";

export interface KeptReport {
  /** The shape's version: a row this code cannot read is read as keeping nothing. */
  version: 1;
  /** The push as enrichment left it — what the communiqué describes. */
  push: NormalizedPush;
  event: Judgement["event"];
  mainLine: boolean;
  violations: ViolationHit[];
  commendations: Commendation[];
  /** The standing the report cites, as it was when the push was recorded. */
  history: HistoryRecord;
  /** The text this row rewrites, when it was asked for again after being sent; null for a first report. */
  rewrites: string | null;
  /**
   * The shas the push brought the record — what the communiqué lists; the rest
   * it only carried (0009 §7). Absent from a row kept before it was, which then
   * lists every commit.
   */
  fresh?: string[];
}

export function keptReport(input: {
  push: NormalizedPush;
  judgement: Pick<Judgement, "event" | "mainLine" | "violations" | "commendations" | "fresh">;
  history: HistoryRecord;
}): KeptReport {
  const { push, judgement, history } = input;
  return {
    version: 1,
    push,
    event: judgement.event,
    mainLine: judgement.mainLine,
    violations: judgement.violations,
    commendations: judgement.commendations,
    history,
    rewrites: null,
    fresh: judgement.fresh,
  };
}

/**
 * A kept report, or null. Null is the answer for a row from before 0012, and
 * for anything this code cannot read: sending from a guess is worse than not
 * sending, and judging again is D-31.
 */
export function readKeptReport(value: Prisma.JsonValue | null): KeptReport | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const kept = fromJson<Partial<KeptReport>>(value);
  const readable =
    kept.version === 1 &&
    typeof kept.push === "object" &&
    Array.isArray(kept.violations) &&
    Array.isArray(kept.commendations) &&
    typeof kept.history === "object" &&
    (kept.fresh === undefined || Array.isArray(kept.fresh));
  return readable ? fromJson<KeptReport>(value) : null;
}

/** What the log shows of it: the event, the line, and who answers for each finding. */
export function judgementOf(kept: KeptReport): DeliveryJudgement {
  const named = (entries: { ruleId: string; login: string }[]) =>
    entries.map(({ ruleId, login }) => ({ ruleId, login }));
  return {
    event: kept.event,
    mainLine: kept.mainLine,
    charges: named(kept.violations),
    credits: named(kept.commendations),
  };
}
