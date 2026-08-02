/**
 * Deterministic measurements over the stored file tree — the third kind of
 * detection, beside the push rules and the model's code review.
 *
 * The difference that matters: a rule reads the *push*, a review reads a diff
 * and forms an opinion, and a check reads the *tree*. Same tree plus same
 * settings gives the same answer forever, which is what lets an old finding be
 * re-proved or withdrawn rather than merely believed.
 *
 * Pure by construction: no measuring happens here, only judging what was
 * measured. See docs/CHECKS-ROADMAP.md.
 */

import type { CheckScope } from "./check-scope.js";
import { DEFAULT_CHECKS } from "./check-defaults.js";

export { DEFAULT_CHECKS };

export const CHECK_METRICS = [
  "file_lines",
  "function_lines",
  "nesting_depth",
  "brace_depth",
  "line_length",
] as const;

export type CheckMetric = (typeof CHECK_METRICS)[number];

/**
 * Is this id a measurement rather than an engagement rule?
 *
 * The two share one id space (see ViolationId) precisely so most readers never
 * have to ask. The ones that do ask are asking about something only a
 * measurement has — a before and an after — and they ask here rather than
 * inferring it from which fields happen to be present.
 */
export function isCheckMetric(id: string): id is CheckMetric {
  return (CHECK_METRICS as readonly string[]).includes(id);
}

export interface CheckConfig extends CheckScope {
  /** A disabled metric is not measured and cannot produce a finding. */
  enabled: boolean;
  threshold: number;
}

/** What a template or a front may say about a metric — any subset of it. Each
 *  field falls back on its own, so overriding a threshold does not silently
 *  discard the scope that came with it. */
export type PartialCheckConfig = Partial<CheckConfig>;

export type CheckConfigMap = Record<CheckMetric, CheckConfig>;
export type PartialCheckMap = Partial<Record<CheckMetric, PartialCheckConfig>>;

/**
 * The shipped defaults. Editable per front in a later step; fixed here so the
 * first metric proves the mechanism before a settings screen exists.
 *
 * `include` is an allowlist of source extensions rather than "everything minus
 * exclusions", because the reliable direction is to judge only what we are sure
 * a person wrote. A missed file is a gap; a violation raised against a vendored
 * bundle or a PNG is the noise that gets a whole check switched off.
 */
/**
 * What this push did to one file's measurement.
 *
 * `none` is silence, not innocence: a file that is over the limit and stayed
 * exactly where it was has nothing to answer for in *this* push.
 */
export type CheckVerdict = "none" | "crossed" | "worsened" | "improved" | "inherited";

export interface CheckReading {
  /** The measurement before this push. Null when the file did not exist. */
  before: number | null;
  after: number;
  threshold: number;
  /** Whether this push touched the path. False during a baseline sweep, where
   *  a file found over the limit is inherited rather than anyone's doing. */
  touched: boolean;
}

/**
 * We violate on the **crossing**, never on the state.
 *
 * A file that was already at four hundred lines and grew by five crossed
 * nothing — its author inherited a mess. Judging the state instead would drown
 * the first mid-life project connected to the platform in violations for last
 * year's code, and a check that fires at everything gets switched off. This
 * project already learned that with `direct_push`.
 *
 * The corollary, which is not decoration: reducing a number that stays over the
 * limit is an **improvement** and is reported as one.
 */
export function judgeCheck({ before, after, threshold, touched }: CheckReading): CheckVerdict {
  if (!touched) return after > threshold ? "inherited" : "none";

  if (after <= threshold) {
    // Brought back under the limit — worth saying so, and only when it was over.
    return before !== null && before > threshold ? "improved" : "none";
  }

  // Created over the limit counts as crossing it: nobody inherited a file that
  // did not exist before this push.
  if (before === null || before <= threshold) return "crossed";

  if (after < before) return "improved";
  if (after > before) return "worsened";
  return "none";
}

/**
 * Three layers, resolved field by field: shipped defaults, then the template a
 * front inherits, then the front's own override.
 *
 * Per *field* and not per metric on purpose. A front that only wants a looser
 * threshold must not lose the scope its template defined — an override that
 * replaced the whole entry would do exactly that, silently, and the file it then
 * failed to exclude would look like a bug in the check rather than in the merge.
 *
 * The metric list is written out by hand for the same reason `mergeWithDefaults`
 * is: a loop needs a widened key and TypeScript then demands a cast, while this
 * makes adding a CheckMetric a compile error right here — which is precisely
 * where the reminder is useful.
 */
export function resolveChecks(
  template: PartialCheckMap | null,
  override: PartialCheckMap | null,
): CheckConfigMap {
  return {
    file_lines: layer(DEFAULT_CHECKS.file_lines, template?.file_lines, override?.file_lines),
    function_lines: layer(
      DEFAULT_CHECKS.function_lines,
      template?.function_lines,
      override?.function_lines,
    ),
    nesting_depth: layer(
      DEFAULT_CHECKS.nesting_depth,
      template?.nesting_depth,
      override?.nesting_depth,
    ),
    brace_depth: layer(DEFAULT_CHECKS.brace_depth, template?.brace_depth, override?.brace_depth),
    line_length: layer(DEFAULT_CHECKS.line_length, template?.line_length, override?.line_length),
  };
}

function layer(
  base: CheckConfig,
  template: PartialCheckConfig | undefined,
  override: PartialCheckConfig | undefined,
): CheckConfig {
  return {
    enabled: override?.enabled ?? template?.enabled ?? base.enabled,
    threshold: override?.threshold ?? template?.threshold ?? base.threshold,
    include: override?.include ?? template?.include ?? base.include,
    exclude: override?.exclude ?? template?.exclude ?? base.exclude,
  };
}
