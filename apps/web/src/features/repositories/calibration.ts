import {
  computeTone,
  GRAVITY_LEVELS,
  type Gravity,
  type ProjectStage,
  type RuleId,
  type ToneLevel,
} from "@commander/shared";

/**
 * What the stage setting actually does, worked out rather than described.
 *
 * The stage and a branch's standing have no visible effect anywhere in the
 * panel: their entire output is the register of a communiqué that arrives
 * later. So the sheet shows the outcome instead of a sentence about it — and it
 * gets that outcome from `computeTone`, the very function the report pipeline
 * runs. A hand-written explanation would be free to drift; this cannot.
 */

/**
 * Two real rules, at opposite ends of the severity table, both as a first
 * offence. Deliberately not an invented "average violation": the operator
 * recognises these two, and a probe with no name teaches nothing.
 */
export const PROBE_RULES: RuleId[] = ["lazy_message", "force_push"];

export interface CalibrationRow {
  gravity: Gravity;
  /** The resulting register per probe rule, in PROBE_RULES order. */
  levels: ToneLevel[];
}

export function calibrate(stage: ProjectStage): CalibrationRow[] {
  return GRAVITY_LEVELS.map((gravity) => ({
    gravity,
    levels: PROBE_RULES.map(
      (ruleId) =>
        computeTone({
          violations: [ruleId],
          // First offence: the honest floor. Repetition only ever hardens this,
          // so what the table shows is the mildest the setting can produce.
          lifetimeCounts: { [ruleId]: 1 },
          stage,
          gravity,
        }).level,
    ),
  }));
}
