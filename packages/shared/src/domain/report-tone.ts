/**
 * How hard the communiqué should press.
 *
 * A persona with one register mocks everything, so a first weekend commit and a
 * seventh force-push over a colleague's work read the same. This grades the
 * response by the two things the operator actually cares about — how bad the act
 * is (RULE_SEVERITY) and how often it has happened — and lets the project's stage
 * move the whole scale, because the same act is not equally serious in week one
 * and in a frozen codebase.
 *
 * Pure and total: every input is a value and every path returns a level, so the
 * register is a fact the model is told rather than a mood it invents.
 */

import { RULE_SEVERITY } from "./dossier-constants.js";
import type { ProjectStage } from "./project.js";
import type { Gravity } from "./watcher.js";
import type { ViolationId } from "./violations.js";

export const TONE_LEVELS = ["commend", "wash", "firm", "severe"] as const;
export type ToneLevel = (typeof TONE_LEVELS)[number];

export interface Tone {
  level: ToneLevel;
  /** The violation that set the register, or null when there was none. */
  ruleId: ViolationId | null;
  /** Lifetime occurrences of that rule, this push included. */
  repeats: number;
}

/** Everything above "commend", in order, so a stage shift is a step on one axis. */
const ESCALATION: ToneLevel[] = ["wash", "firm", "severe"];

/**
 * A repeat weighs more than a first offence, but not without bound: the third
 * time is what proves a pattern, and the thirtieth is not thirty times worse.
 *
 * A table rather than an if-chain so the manual can print the real bands. A
 * documented threshold that is retyped by hand is a threshold that will one day
 * be wrong in one of the two places.
 */
export const REPEAT_BANDS: readonly { upTo: number; factor: number }[] = [
  { upTo: 1, factor: 1 },
  { upTo: 3, factor: 1.5 },
  { upTo: 7, factor: 2 },
  { upTo: Number.POSITIVE_INFINITY, factor: 3 },
];

function repeatFactor(repeats: number): number {
  return REPEAT_BANDS.find((band) => repeats <= band.upTo)?.factor ?? 1;
}

/**
 * Bootstrap forgives one step and frozen adds one: scaffolding chaos in week one
 * is not the offence it would be against a codebase declared closed.
 *
 * Exported so the panel can label each rung of the stage ladder with what it
 * actually does. Restating these numbers in the UI would let the explanation
 * drift away from the behaviour — the one thing a calibration control must
 * never do.
 */
export const STAGE_SHIFT: Record<ProjectStage, number> = {
  bootstrap: -1,
  active: 0,
  hardening: 0,
  frozen: 1,
};

/**
 * A branch's standing moves the same axis: the identical act is heavier on a
 * protected trunk than on a scratch branch. It never changes how deeply the code
 * is examined — only how hard the finding lands.
 */
export const GRAVITY_SHIFT: Record<Gravity, number> = {
  routine: 0,
  guarded: 1,
  critical: 2,
};

export function computeTone(input: {
  /** Rules broken by this push. */
  violations: ViolationId[];
  /** Lifetime count per rule, this push already counted. */
  lifetimeCounts: Record<string, number>;
  stage: ProjectStage;
  /** Standing of the branch pushed to (see resolveWatcher). */
  gravity: Gravity;
}): Tone {
  const { violations, lifetimeCounts, stage, gravity } = input;

  // The worst single violation sets the register; a push is not judged by the
  // average of its faults, and stacking minor ones must not manufacture alarm.
  let ruleId: ViolationId | null = null;
  let repeats = 0;
  let pressure = -1;

  for (const candidate of violations) {
    const count = Math.max(1, lifetimeCounts[candidate] ?? 1);
    const value = (RULE_SEVERITY[candidate] ?? 1) * repeatFactor(count);
    if (value > pressure) {
      pressure = value;
      ruleId = candidate;
      repeats = count;
    }
  }

  if (!ruleId) return { level: "commend", ruleId: null, repeats: 0 };

  const step = pressure < 1.2 ? 0 : pressure < 3 ? 1 : 2;
  const adjusted = step + STAGE_SHIFT[stage] + GRAVITY_SHIFT[gravity];
  const shifted = Math.min(ESCALATION.length - 1, Math.max(0, adjusted));

  return { level: ESCALATION[shifted] ?? "firm", ruleId, repeats };
}
