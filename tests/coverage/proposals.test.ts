/**
 * A proposal's status is real, and the file and the index say the same thing.
 *
 * Changing a status is a commitment decision reserved to the developer
 * (`docs/proposals/README.md`), and nothing in a working tree records who typed a
 * change — so that part cannot be guarded. What can be guarded is the half-done
 * version of it: a file flipped and an index left behind, or a status word nobody
 * defined. Both leave the project unable to say what was actually decided, which
 * is the damage the rule exists to prevent.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lineOf, markdown, report, ROOT, type Finding } from "../lib/sources.js";

const DIR = "docs/proposals/";
const STATUSES = ["مطروح", "مقبول", "مرفوض", "منفَّذ"];

/** `| **الحالة** | مطروح |` — the header table every proposal opens with. */
const STATUS_ROW = /^\|\s*\*\*الحالة\*\*\s*\|\s*([^|]+?)\s*\|/m;

/** `| [0002](0002-persona-identity.md) | title | مطروح |` in the index. */
const INDEX_ROW = /^\|\s*\[\d+\]\(([\w.-]+\.md)\)\s*\|[^|]*\|\s*([^|]+?)\s*\|/gm;

const isProposal = (path: string): boolean =>
  path.startsWith(DIR) && /\/\d{4}-/.test(path) && !path.endsWith("TEMPLATE.md");

test("every proposal declares a status the project defines", () => {
  const findings: Finding[] = [];

  for (const file of markdown()) {
    if (!isProposal(file.path)) continue;

    const match = STATUS_ROW.exec(file.text);
    if (match === null) {
      findings.push({ path: file.path, line: 1, detail: "no **الحالة** row in the header table" });
      continue;
    }
    if (!STATUSES.includes(match[1]!)) {
      findings.push({
        path: file.path,
        line: lineOf(file.text, match.index),
        detail: `"${match[1]}" is not a status — use one of ${STATUSES.join(" · ")}`,
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "docs/proposals/README.md — the four statuses")}\n\nCopy the header table from TEMPLATE.md. A status nobody defined cannot be read as a decision.`,
  );
});

test("the index agrees with each proposal about its status", () => {
  const indexPath = `${DIR}README.md`;
  const index = readFileSync(join(ROOT, indexPath), "utf8");
  const findings: Finding[] = [];
  const listed = new Set<string>();

  for (const row of index.matchAll(INDEX_ROW)) {
    const [, file, claimed] = row;
    listed.add(file!);

    const text = readFileSync(join(ROOT, DIR, file!), "utf8");
    const actual = STATUS_ROW.exec(text)?.[1];

    if (actual !== undefined && actual !== claimed) {
      findings.push({
        path: indexPath,
        line: lineOf(index, row.index),
        detail: `index says "${claimed}", ${file} says "${actual}"`,
      });
    }
  }

  for (const file of markdown()) {
    const name = file.path.slice(DIR.length);
    if (!isProposal(file.path) || listed.has(name)) continue;
    findings.push({ path: file.path, line: 1, detail: "not listed in the index" });
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "docs/proposals/README.md — index and file must agree")}\n\nA status changed in one place and not the other leaves nobody able to say what was decided. Fix both, or neither.`,
  );
});
