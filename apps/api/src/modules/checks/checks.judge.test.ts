/**
 * The judgement, with no database in sight — which is the point of having split
 * it out. Every case below is a sentence from docs/CHECKS-ROADMAP.md §2 turned
 * into an assertion, including the ones that must produce *nothing*.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CHECKS, type CheckConfigMap } from "@commander/shared";
import { judgeFile, type Reading } from "@/modules/checks/checks.judge.js";
import type { MeasureTarget } from "@/modules/checks/checks.measure.js";

const LIMIT = 200;

/** Only `file_lines` is live here, so one metric's numbers cannot be read as
 *  another's when a case fails. */
const checks: CheckConfigMap = {
  ...DEFAULT_CHECKS,
  file_lines: { ...DEFAULT_CHECKS.file_lines, enabled: true, threshold: LIMIT },
  function_lines: { ...DEFAULT_CHECKS.function_lines, enabled: false },
  nesting_depth: { ...DEFAULT_CHECKS.nesting_depth, enabled: false },
  brace_depth: { ...DEFAULT_CHECKS.brace_depth, enabled: false },
  line_length: { ...DEFAULT_CHECKS.line_length, enabled: false },
};

const target: MeasureTarget = {
  installationId: "1",
  fullName: "unit/test",
  repositoryId: "repo",
  checks,
};

const reading = (lines: number | null): Reading => ({
  lines,
  functionLines: null,
  nestingDepth: null,
  braceDepth: null,
  longestLine: null,
});

/** One file, judged from its before and after line counts. */
function judge(before: number | null, after: number) {
  const readings = new Map<string, Reading>([["after", reading(after)]]);
  if (before !== null) readings.set("before", reading(before));

  return judgeFile(
    target,
    { path: "src/a.ts", sha: "after", previousSha: before === null ? null : "before" },
    readings,
  );
}

test("crossing the limit is charged to whoever crossed it", () => {
  const outcome = judge(190, 210);

  assert.equal(outcome.violations.length, 1);
  assert.equal(outcome.commendations.length, 0);
  assert.deepEqual(outcome.violations[0]?.detail, {
    path: "src/a.ts",
    before: 190,
    after: 210,
    threshold: LIMIT,
  });
});

test("inheriting a mess and adding to it charges nobody", () => {
  const outcome = judge(400, 405);

  assert.equal(outcome.violations.length, 0, "405 crossed nothing — 400 was already over");
  assert.equal(outcome.commendations.length, 0, "and it is not an improvement either");
});

test("coming down while still over the limit is a credit", () => {
  const outcome = judge(400, 350);

  assert.equal(outcome.violations.length, 0);
  assert.equal(outcome.commendations.length, 1);
  assert.deepEqual(outcome.commendations[0]?.detail, {
    path: "src/a.ts",
    before: 400,
    after: 350,
    threshold: LIMIT,
  });
});

test("coming back under the limit is a credit too", () => {
  const outcome = judge(210, 150);

  assert.equal(outcome.commendations.length, 1);
  assert.equal(outcome.violations.length, 0);
});

test("a file created over the limit is charged, and claims no `before`", () => {
  const outcome = judge(null, 210);

  assert.equal(outcome.violations.length, 1);
  // The absence is the assertion: a zero here would read as "it measured zero
  // lines", which is a measurement nobody took.
  assert.equal(outcome.violations[0]?.detail["before"], undefined);
  assert.equal(outcome.violations[0]?.detail["after"], 210);
});

test("a file that was never measured before is not charged on a guess", () => {
  const readings = new Map<string, Reading>([["after", reading(210)]]);
  const outcome = judgeFile(
    target,
    { path: "src/a.ts", sha: "after", previousSha: "gone" },
    readings,
  );

  assert.equal(outcome.violations.length, 0, "an unmeasured before cannot prove a crossing");
  assert.equal(outcome.commendations.length, 0);
});

test("an unmeasurable file produces neither charge nor credit", () => {
  const readings = new Map<string, Reading>([
    ["after", reading(null)],
    ["before", reading(190)],
  ]);
  const outcome = judgeFile(
    target,
    { path: "src/a.ts", sha: "after", previousSha: "before" },
    readings,
  );

  assert.equal(outcome.violations.length, 0);
  assert.equal(outcome.commendations.length, 0);
});

test("a disabled metric is silent in both directions", () => {
  const off: MeasureTarget = {
    ...target,
    checks: { ...checks, file_lines: { ...checks.file_lines, enabled: false } },
  };
  const readings = new Map<string, Reading>([
    ["after", reading(350)],
    ["before", reading(400)],
  ]);

  const outcome = judgeFile(
    off,
    { path: "src/a.ts", sha: "after", previousSha: "before" },
    readings,
  );

  assert.equal(outcome.commendations.length, 0, "praise from a check nobody enabled is noise too");
});

test("a path outside the metric's scope is not judged", () => {
  const scoped: MeasureTarget = {
    ...target,
    checks: { ...checks, file_lines: { ...checks.file_lines, exclude: ["src/**"] } },
  };

  const readings = new Map<string, Reading>([
    ["after", reading(210)],
    ["before", reading(190)],
  ]);
  const outcome = judgeFile(
    scoped,
    { path: "src/a.ts", sha: "after", previousSha: "before" },
    readings,
  );

  assert.equal(outcome.violations.length, 0);
});
