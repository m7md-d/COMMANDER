/**
 * The defect log and the scenario reference name the same open defects.
 *
 * The reference (`apps/api/src/scenarios/`) is the form that runs: a `defect`
 * record fails the moment the code stops judging as it says. `docs/DEFECTS.md`
 * is the form that is read and kept: each defect's cause and, once fixed, its
 * fix. A log nobody is made to update drifts into a list of things that were
 * true once — so an open entry must name a scenario that still carries its
 * record, and every record must have an open entry.
 *
 * And no defect without a test: every open entry names what proves it — a
 * scenario, or a test file that exists — and how that test was seen doing real
 * work the first time. A test that skips, or passes for a reason other than the
 * one written, looks like coverage and is not.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lineOf, report, ROOT, under, type Finding } from "../lib/sources.js";

const LOG = "docs/DEFECTS.md";
const OPEN = "\n## مفتوحة\n";
const FIXED = "\n## مُصلَحة\n";

/** `- **المشاهد:** `a-scenario` · `another-one`` — ids only, not file names. */
const SCENES = /^- \*\*المشاهد:\*\*(.*)$/gm;
const SCENARIO_ID = /`([a-z0-9]+(?:-[a-z0-9]+)+)`/g;

/** `- **الاختبار:** `apps/…/x.test.ts`` — a test that is not a scenario. */
const TEST_FILE = /^- \*\*الاختبار:\*\*\s*`([^`]+)`/m;
const PROOF = /^- \*\*الإثبات:\*\*\s*\S/m;

/** Each scenario that carries a `defect` record, by the file and line it is in. */
function recorded(): Map<string, Finding> {
  const found = new Map<string, Finding>();
  for (const file of under("apps/api/src/scenarios/")) {
    if (!file.path.endsWith(".test.ts")) continue;
    let id: string | undefined;
    for (const match of file.text.matchAll(/id: "([^"]+)"|defect: \{/g)) {
      if (match[1] !== undefined) id = match[1];
      else if (id !== undefined) found.set(id, { path: file.path, line: lineOf(file.text, match.index), detail: id });
    }
  }
  return found;
}

/** Where the open section starts and ends. */
function openSection(text: string): { start: number; end: number } {
  const start = text.indexOf(OPEN);
  const end = text.indexOf(FIXED);
  assert.ok(start !== -1 && end > start, `${LOG} must hold "## مفتوحة" and then "## مُصلَحة" — the guard reads the section between them.`);
  return { start, end };
}

/** Each scenario an open entry names, with where it names it. */
function logged(text: string): Map<string, number> {
  const { start, end } = openSection(text);
  const names = new Map<string, number>();
  for (const line of text.slice(start, end).matchAll(SCENES)) {
    for (const id of line[1]!.matchAll(SCENARIO_ID)) names.set(id[1]!, lineOf(text, start + line.index));
  }
  return names;
}

/** What is missing from one entry: a test that proves it, and the proof that the test works. */
function unproven(entry: string): string[] {
  const missing: string[] = [];
  const scenes = [...(SCENES.exec(entry)?.[1] ?? "").matchAll(SCENARIO_ID)];
  SCENES.lastIndex = 0;
  const file = TEST_FILE.exec(entry)?.[1];
  if (scenes.length === 0 && file === undefined) missing.push("names no test — a scenario in **المشاهد:**, or a file in **الاختبار:**");
  if (file !== undefined && !existsSync(join(ROOT, file))) missing.push(`**الاختبار:** ${file} does not exist`);
  if (!PROOF.test(entry)) missing.push("has no **الإثبات:** — say how the test was seen doing real work the first time");
  return missing;
}

test("every open defect in the reference has an open entry in the log, and no open entry is fixed", () => {
  const text = readFileSync(join(ROOT, LOG), "utf8");
  const records = recorded();
  const entries = logged(text);
  const findings: Finding[] = [];

  for (const [id, where] of records) {
    if (!entries.has(id)) findings.push({ ...where, detail: `defect record "${id}" has no open entry in ${LOG} — add one with its cause` });
  }
  for (const [id, line] of entries) {
    if (!records.has(id)) {
      findings.push({ path: LOG, line, detail: `"${id}" carries no defect record any more — move the entry to "مُصلَحة" and write the cause and the fix` });
    }
  }

  assert.equal(findings.length, 0, `${report(findings, `${LOG} — the log and the reference agree`)}\n\nThe format is at the top of ${LOG}. A fixed entry is moved, never deleted.`);
});

test("every open defect names the test that proves it, and how that test was seen working", () => {
  const text = readFileSync(join(ROOT, LOG), "utf8");
  const { start, end } = openSection(text);
  const findings: Finding[] = [];

  for (const heading of text.slice(start, end).matchAll(/^### (D-\d+)[^\n]*\n([\s\S]*?)(?=^### |(?![\s\S]))/gm)) {
    for (const detail of unproven(heading[2]!)) {
      findings.push({ path: LOG, line: lineOf(text, start + heading.index), detail: `${heading[1]} ${detail}` });
    }
  }

  assert.equal(findings.length, 0, `${report(findings, `${LOG} — no defect without a test`)}\n\nThe order is at the top of ${LOG}: the test first, seen working, then the fix.`);
});
