/**
 * Reading a measurement and deciding what it means.
 *
 * Pure — it only compares numbers — and in the domain so the decision about a
 * push (`judgePush`) and the scenario reference can both call it with no
 * database in reach. Kept in one file so the metric-to-column map and the
 * verdict split can be read in one screen: it is the half most likely to be
 * wrong in a way tests can catch.
 */

import {
  CHECK_METRICS,
  inScope,
  judgeCheck,
  measureContent,
  type CheckConfigMap,
  type CheckMetric,
  type Commendation,
  type RuleDetail,
  type ViolationHit,
} from "@commander/shared";
import type { TouchedFile } from "@/domain/tree/diff.js";
import { readSyntax } from "./syntax.js";

/**
 * What one push did to the files it touched, in both directions.
 *
 * Two lists rather than one tagged list: the caller does entirely different
 * things with them — one joins the violation stream that feeds the tone, the
 * embed colour and the repeat bands; the other must touch none of those.
 */
export interface CheckOutcome {
  violations: ViolationHit[];
  commendations: Commendation[];
}

/** The stored columns a metric can be read from. */
export interface Reading {
  lines: number | null;
  functionLines: number | null;
  nestingDepth: number | null;
  braceDepth: number | null;
  longestLine: number | null;
}

/**
 * Every measurement of one blob, from one pass over its content. The worker
 * stores this against the blob's hash; the scenario reference reads it straight
 * from git — the same numbers either way.
 */
export function readingOf(path: string, content: string): Reading {
  const counted = measureContent(content);
  const syntax = readSyntax(path, content);
  return {
    lines: counted.lines,
    functionLines: syntax.functionLines,
    nestingDepth: syntax.nestingDepth,
    braceDepth: counted.braceDepth,
    longestLine: counted.longestLine,
  };
}

/** True when at least one enabled metric claims this path — the only paths worth a blob's bytes. */
export function wanted(checks: CheckConfigMap, path: string): boolean {
  return CHECK_METRICS.some((metric) => checks[metric].enabled && inScope(checks[metric], path));
}

/**
 * Which column answers which metric.
 *
 * Written out rather than derived from the name: a metric and its column are two
 * decisions, and a convention that silently maps one onto the other turns a typo
 * into a check quietly reading the wrong number. Adding a `CheckMetric` is a
 * compile error right here, which is where the reminder belongs.
 */
const READ: Record<CheckMetric, (reading: Reading) => number | null> = {
  file_lines: (reading) => reading.lines,
  function_lines: (reading) => reading.functionLines,
  nesting_depth: (reading) => reading.nestingDepth,
  brace_depth: (reading) => reading.braceDepth,
  line_length: (reading) => reading.longestLine,
};

/** Every enabled metric that claims this path, judged on its own numbers. */
export function judgeFile(
  checks: CheckConfigMap,
  file: TouchedFile,
  readings: ReadonlyMap<string, Reading>,
): CheckOutcome {
  const after = readings.get(file.sha);
  const previous = file.previousSha === null ? null : readings.get(file.previousSha);
  const outcome: CheckOutcome = { violations: [], commendations: [] };

  for (const metric of CHECK_METRICS) {
    const config = checks[metric];
    if (!config.enabled || !inScope(config, file.path)) continue;

    const now = after ? READ[metric](after) : null;
    if (now === null) continue;

    const before = previous ? READ[metric](previous) : null;
    // A file whose previous reading is missing is indistinguishable from one
    // that has always been this way, so it is treated as inherited.
    if (file.previousSha !== null && before === null) continue;

    const verdict = judgeCheck({ before, after: now, threshold: config.threshold, touched: true });
    const entry = {
      ruleId: metric,
      detail: detailFor({ path: file.path, before, after: now, threshold: config.threshold }),
    };

    // `worsened` and `inherited` are deliberately absent: 400 → 405 crossed
    // nothing, and neither charging nor crediting it is the point of the rule.
    if (verdict === "crossed") outcome.violations.push(entry);
    else if (verdict === "improved") outcome.commendations.push(entry);
  }

  return outcome;
}

/**
 * The numbers that prove the entry, in the shape its label interpolates.
 *
 * `before` is omitted rather than sent as zero when the file did not exist. A
 * zero there would read as "it was zero lines", which is a measurement nobody
 * took — the same substitution `lines: null` exists to refuse, and the label
 * picks a different sentence when it is missing.
 */
function detailFor(reading: {
  path: string;
  before: number | null;
  after: number;
  threshold: number;
}): RuleDetail {
  const { path, before, after, threshold } = reading;
  const detail: RuleDetail = { path, after, threshold };
  if (before !== null) detail["before"] = before;
  return detail;
}
