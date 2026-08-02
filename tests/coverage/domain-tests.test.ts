/**
 * Every pure function in `domain/` is named by a test.
 *
 * `domain/` is where the judgements live — what counts as a violation, when a
 * digest is due, whether a file crossed its limit. It takes no I/O and needs no
 * database, so there is no excuse available anywhere else in the project: if a
 * rule here is wrong, only a test finds out, and the report is wrong about a real
 * person's work in the meantime.
 *
 * Naming, not coverage instrumentation: a test that never mentions the function
 * is not testing it, and a coverage percentage can be satisfied by a test that
 * asserts nothing. This asks the cheaper and stricter question.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  codeOnly,
  isTest,
  lineOf,
  report,
  sources,
  symbolsOnly,
  type Finding,
} from "../lib/sources.js";

const DOMAINS = ["packages/shared/src/domain/", "apps/api/src/domain/"];

const EXPORTED = /^export (?:(?:async )?function|const) ([A-Za-z0-9_]+)\s*(?:[(<]|=\s*(?:async\s*)?\()/gm;

/**
 * The gap measured on 2026-08-03, the day this guard was written: 31 functions
 * that predate the rule. Listing them is what let the rule start applying to new
 * work immediately instead of waiting for a day nobody was going to schedule.
 *
 * **The list may only shrink.** A name that has since been tested, or that no
 * longer exists, fails this guard too — an exception nobody removed is a claim
 * about the code that stopped being true. Delete the line when you write the
 * test; never add one.
 */
const UNTESTED_AT_ADOPTION = new Set([
  "absorb",
  "buildCommendationBlock",
  "buildCommitBlock",
  "buildHistoryBlock",
  "buildReviewBlock",
  "buildStructureBlock",
  "buildViolationBlock",
  "credit",
  "defaultRuleConfig",
  "digestTrigger",
  "emptyTotals",
  "evaluateRules",
  "fallbackReport",
  "fileTotals",
  "findAnomalies",
  "hourInWindow",
  "isCheckMetric",
  "isGitHubUiCommit",
  "isMergeCommit",
  "isOver",
  "leader",
  "localHour",
  "localWeekday",
  "mergeWithDefaults",
  "patternMatches",
  "promptRetainsGuard",
  "rankMovers",
  "renderTemplate",
  "retryDelayMs",
  "sanitizeQuote",
  "totalFilesTouched",
]);

interface Export {
  name: string;
  path: string;
  line: number;
}

function domainExports(): Export[] {
  const found: Export[] = [];

  for (const file of sources()) {
    if (isTest(file) || !DOMAINS.some((dir) => file.path.startsWith(dir))) continue;
    for (const match of codeOnly(file.text).matchAll(EXPORTED)) {
      found.push({ name: match[1]!, path: file.path, line: lineOf(file.text, match.index) });
    }
  }

  return found;
}

/**
 * Colocated unit tests only. The guards under `tests/` are excluded by `sources`
 * already, which matters here more than anywhere: this file names all 31
 * exceptions, and a corpus that included it would find every one of them
 * "tested" by its own allow-list.
 *
 * Identifiers only — test *titles* are prose. `"coming back under the limit is a
 * credit"` was marking `credit()` as tested when nothing calls it.
 */
function testedNames(): Set<string> {
  const names = new Set<string>();

  for (const file of sources()) {
    if (!isTest(file)) continue;
    for (const word of symbolsOnly(file.text).matchAll(/[A-Za-z0-9_]+/g)) names.add(word[0]);
  }

  return names;
}

test("every domain function is named by a test", () => {
  const exported = domainExports();
  const tested = testedNames();
  const findings: Finding[] = [];

  for (const { name, path, line } of exported) {
    if (tested.has(name) || UNTESTED_AT_ADOPTION.has(name)) continue;
    findings.push({ path, line, detail: `${name}() is exported from domain and no test names it` });
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "CLAUDE.md — a domain function ships with its test")}\n\nWrite the test beside the module. If the function is not worth a test, it is not worth being exported from domain/.`,
  );
});

test("no exception outlives the gap it recorded", () => {
  const live = new Map(domainExports().map((entry) => [entry.name, entry]));
  const tested = testedNames();
  const findings: Finding[] = [];

  for (const name of UNTESTED_AT_ADOPTION) {
    const entry = live.get(name);
    if (entry === undefined) {
      findings.push({
        path: "tests/coverage/domain-tests.test.ts",
        line: 1,
        detail: `${name} is on the list but no longer exported from domain/`,
      });
    } else if (tested.has(name)) {
      findings.push({
        path: entry.path,
        line: entry.line,
        detail: `${name}() now has a test — remove it from UNTESTED_AT_ADOPTION`,
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "tests/coverage/domain-tests.test.ts — the list may only shrink")}\n\nDelete the name from UNTESTED_AT_ADOPTION. An exception kept past its reason is a false statement about the code.`,
  );
});
