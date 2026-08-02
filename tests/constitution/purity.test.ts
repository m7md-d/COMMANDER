/**
 * CONSTITUTION.md §2 (types are the contract), §3 (no visible text in code) and
 * §6 (never swallow an error).
 *
 * These are the rules a compiler cannot hold: `any` compiles, an empty catch
 * compiles, and an Arabic sentence in a component compiles beautifully.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { codeOnly, isTest, lineOf, report, sources, type Finding } from "../lib/sources.ts";

/** The one sanctioned narrowing point for Prisma's Json columns. */
const JSON_BOUNDARY = "apps/api/src/core/json.ts";

/**
 * Files whose Arabic is addressed to the model, not to a person: prompt bodies,
 * the blocks assembled into them, and the vocabulary used to match a model's
 * own output. Plus the dictionaries themselves, which are the whole point.
 *
 * Anything not on this list that carries an Arabic string literal is a label
 * that escaped i18n — which is exactly what this guard is for.
 */
const MODEL_FACING = [
  /^packages\/shared\/src\/i18n\//,
  /^packages\/shared\/src\/domain\/(prompt|review)\.ts$/,
  /^apps\/api\/src\/domain\/report\/prompt-blocks\.ts$/,
  /^apps\/api\/src\/modules\/dossier\/(review\.build|narrative\.service)\.ts$/,
  /^apps\/api\/src\/modules\/prompts\/prompts\.service\.ts$/,
];

test("no `any`, anywhere", () => {
  const findings: Finding[] = [];
  const pattern = /(:|\bas\s+)\s*any\b|<any>|\bany\[\]/g;

  for (const file of sources()) {
    const code = codeOnly(file.text);
    for (let m = pattern.exec(code); m; m = pattern.exec(code)) {
      findings.push({ path: file.path, line: lineOf(code, m.index), detail: m[0].trim() });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "CONSTITUTION.md §2")}\n\n\`unknown\` plus a zod check is the replacement.`,
  );
});

test("`as unknown as` lives only at the sanctioned JSON boundary", () => {
  const findings: Finding[] = [];

  for (const file of sources()) {
    if (file.path === JSON_BOUNDARY) continue;
    const code = codeOnly(file.text);
    const pattern = /as\s+unknown\s+as/g;
    for (let m = pattern.exec(code); m; m = pattern.exec(code)) {
      findings.push({ path: file.path, line: lineOf(code, m.index), detail: "double cast" });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "CONSTITUTION.md §2")}\n\nCross the Json boundary through toJson/fromJson in ${JSON_BOUNDARY}.`,
  );
});

test("no error is swallowed silently", () => {
  const findings: Finding[] = [];
  const pattern = /catch\s*(\([^)]*\))?\s*\{\s*\}/g;

  for (const file of sources()) {
    // Deliberately the RAW source, not `codeOnly`. What §6 forbids is swallowing
    // an error *without an account of why* — a catch whose body is a written
    // justification is a decision on the record, which is the same standard §9
    // sets for departing from any rule. Blanking comments first would have
    // failed exactly the three places that did this correctly.
    for (let m = pattern.exec(file.text); m; m = pattern.exec(file.text)) {
      findings.push({
        path: file.path,
        line: lineOf(file.text, m.index),
        detail: "catch block with neither handling nor a stated reason",
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "CONSTITUTION.md §6")}\n\nHandle it, log and rethrow, or write why swallowing is correct.`,
  );
});

test("no user-facing text is written in code", () => {
  const findings: Finding[] = [];
  // A single-line string literal holding Arabic letters. Comments are already
  // blanked, so an Arabic explanation above a function is not a finding, and
  // the newline exclusion stops one unterminated quote swallowing the file.
  const pattern = /(["'`])((?:(?!\1)[^\\\n]|\\.)*[؀-ۿ](?:(?!\1)[^\\\n]|\\.)*)\1/g;

  for (const file of sources()) {
    // Fixtures quote what a model actually returns; that is the subject under
    // test, not a label that escaped the dictionary.
    if (isTest(file)) continue;
    if (MODEL_FACING.some((allowed) => allowed.test(file.path))) continue;
    const code = codeOnly(file.text);
    for (let m = pattern.exec(code); m; m = pattern.exec(code)) {
      findings.push({
        path: file.path,
        line: lineOf(code, m.index),
        detail: `literal: ${m[2]?.slice(0, 40)}`,
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "CONSTITUTION.md §3")}\n\nEvery label is a key in packages/shared/src/i18n/.`,
  );
});
