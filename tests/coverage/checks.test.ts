/**
 * Checks and rules share one id space, one ledger and one set of label keys.
 *
 * That was the point — the dossier, the repeat bands and the statistics all read
 * `violation_events` and needed no teaching about a second source. The price is
 * that the two id sets must stay disjoint, and nothing in TypeScript says so: a
 * metric named after an existing rule compiles, stores, and silently merges two
 * different kinds of finding into one person's history.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { sources, type Finding } from "../lib/sources.ts";

/** Names listed in a `const X = [...] as const` array, in source order. */
function listed(text: string, name: string): string[] {
  const block = new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`).exec(text)?.[1] ?? "";
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
}

function read(suffix: string): string {
  const file = sources().find((candidate) => candidate.path.endsWith(suffix));
  assert.ok(file, `expected ${suffix} to exist`);
  return file.text;
}

test("no check metric is named after a rule", () => {
  const rules = listed(read("domain/violations.ts"), "RULE_IDS");
  const metrics = listed(read("domain/checks.ts"), "CHECK_METRICS");

  assert.ok(rules.length > 0 && metrics.length > 0, "both id lists must be readable");

  const clash = metrics.filter((metric) => rules.includes(metric));
  assert.deepEqual(
    clash,
    [],
    `A metric and a rule share an id: ${clash.join(", ")}.\n\nOne id space means one meaning per id. Rename the metric.`,
  );
});

/**
 * A check reaches the reader through `rule.<id>.*`, exactly as a rule does, and
 * through `RULE_SEVERITY` for its weight in the dossier and the tone. Both are
 * looked up dynamically, so a metric added without them fails at *runtime* —
 * rendering a raw key and scoring as a default — rather than at compile time.
 */
test("every check metric carries its label, hint, report and severity", () => {
  const findings: Finding[] = [];
  const metrics = listed(read("domain/checks.ts"), "CHECK_METRICS");
  const dictionary = read("i18n/ar.ts");
  const severity = read("domain/dossier-constants.ts");

  for (const metric of metrics) {
    for (const part of ["label", "hint", "report"]) {
      if (!dictionary.includes(`"rule.${metric}.${part}"`)) {
        findings.push({ path: "packages/shared/src/i18n/ar.ts", line: 1, detail: `rule.${metric}.${part}` });
      }
    }
    if (!new RegExp(`\\b${metric}\\s*:\\s*[\\d.]`).test(severity)) {
      findings.push({
        path: "packages/shared/src/domain/dossier-constants.ts",
        line: 1,
        detail: `${metric} has no severity`,
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${findings.map((f) => `  ${f.path}  missing ${f.detail}`).join("\n")}\n\nAdd the three keys in both dictionaries and a weight in RULE_SEVERITY.`,
  );
});
