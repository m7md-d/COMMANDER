/**
 * CONSTITUTION.md §4 — structural size limits.
 *
 * Mechanical because file bloat is gradual: it never arrives in a single
 * reviewable diff, so no human review catches it. The tighter component limit
 * exists because a page is meant to be composition only; a .tsx that keeps
 * growing is a page that started holding logic.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { SIZE } from "../lib/budgets.ts";
import {
  codeOnly,
  isComponent,
  isTest,
  lineCount,
  lineOf,
  report,
  sources,
  type Finding,
} from "../lib/sources.ts";

const exempt = (path: string) => SIZE.exempt.some((pattern) => pattern.test(path));

test("no source file exceeds the line limit", () => {
  const findings: Finding[] = [];

  for (const file of sources()) {
    if (exempt(file.path) || isTest(file)) continue;
    const limit = isComponent(file) ? SIZE.component : SIZE.file;
    const lines = lineCount(file.text);
    if (lines > limit) {
      findings.push({ path: file.path, line: lines, detail: `${lines} lines, limit ${limit}` });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "CONSTITUTION.md §4")}\n\nSplit them by responsibility. Do not raise the limit.`,
  );
});

/**
 * A test file may be long — it is a list of cases, not a unit of logic — but not
 * unboundedly so: past a point it is two suites sharing a filename.
 */
test("test files stay navigable", () => {
  const findings: Finding[] = [];
  const limit = SIZE.file * 2;

  for (const file of sources()) {
    if (!isTest(file)) continue;
    const lines = lineCount(file.text);
    if (lines > limit) {
      findings.push({ path: file.path, line: lines, detail: `${lines} lines, limit ${limit}` });
    }
  }

  assert.equal(findings.length, 0, report(findings, "test file size"));
});

/**
 * CONSTITUTION.md §4 and apps/web/CONSTITUTION.md §5: one `useEffect` per file.
 *
 * Automated 2026-07-27 alongside max-params and max-depth in eslint. eslint has
 * no rule for this one, and it is the limit least likely to be caught by eye:
 * the second effect never arrives in the same diff as the first, and by the
 * third nobody can say what order they run in or which one owns the cleanup.
 *
 * The count is per *file* rather than per component, because a file holding two
 * components with an effect each is already past web §5's other rule.
 */
test("no component drives more than one effect", () => {
  const findings: Finding[] = [];

  for (const file of sources()) {
    if (!isComponent(file) && file.ext !== ".ts") continue;
    if (isTest(file)) continue;

    const code = codeOnly(file.text);
    const uses = [...code.matchAll(/\buseEffect\s*\(/g)];
    if (uses.length > 1) {
      findings.push({
        path: file.path,
        line: lineOf(code, uses[1]!.index),
        detail: `${uses.length} useEffect calls, limit 1`,
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "CONSTITUTION.md §4")}\n\nMore than one effect is logic that belongs in a custom hook.`,
  );
});
