/**
 * CONSTITUTION.md §3 — the dictionaries stay honest.
 *
 * The type system already catches a key present in Arabic and missing in
 * English: `ar` defines `TranslationKey` and `en` is typed against it. What it
 * cannot catch is the other two failures — a key nobody reads any more, and a
 * key read by code that the dictionary has never heard of. The first is debris
 * from a deleted screen; the second renders the raw key to a user.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { isTest, lineOf, report, sources, type Finding } from "../lib/sources.ts";

const dictionary = (locale: string) =>
  sources().find((file) => file.path.endsWith(`i18n/${locale}.ts`));

function keysOf(text: string): string[] {
  return [...text.matchAll(/^\s*"([a-zA-Z0-9._]+)":/gm)].map((m) => m[1] ?? "");
}

/**
 * Families addressed by template, never by literal: `t(\`rule.${id}.label\`)`.
 * Each prefix is a real interpolation in the app, and the union type behind it
 * is what keeps the set complete — so a member of one is used by construction.
 */
const TEMPLATED = [
  "stage.",
  "tone.",
  "gravity.",
  "rule.",
  "day.",
  "review.verdict.",
  "violation.",
  "nav.",
  "navDesc.",
  "theme.",
  "achv.",
  "tier.",
  "delivery.status.",
  "delivery.reason.",
  "var.",
  // The manual prints a row per member of an enum it imports, so these families
  // are complete or the table is. A missing member shows as a blank cell in the
  // rendered page, which the missing-key guard below reports by name.
  "manual.state.",
  "manual.terminal.",
  "manual.capability.",
  "manual.register.",
  // Built by `scanBlockerKey(blocker)` from the SCAN_BLOCKERS union, so the
  // family is complete by construction and a member with no reader is a member
  // the server can never return.
  "scan.blocked.",
];

/** Everything that reads keys — the dictionaries themselves excluded. */
function consumers(): string {
  return sources()
    .filter((file) => !file.path.includes("/i18n/") && !isTest(file))
    .map((file) => file.text)
    .join("\n");
}

test("arabic and english carry exactly the same keys", () => {
  const ar = dictionary("ar");
  const en = dictionary("en");
  assert.ok(ar && en, "both dictionaries must exist");

  const arKeys = new Set(keysOf(ar.text));
  const enKeys = new Set(keysOf(en.text));

  const missing = [...arKeys].filter((key) => !enKeys.has(key));
  const extra = [...enKeys].filter((key) => !arKeys.has(key));

  assert.deepEqual({ missing, extra }, { missing: [], extra: [] });
});

test("no translation key is left behind by the code that used it", () => {
  const ar = dictionary("ar");
  assert.ok(ar);

  const corpus = consumers();
  const findings: Finding[] = keysOf(ar.text)
    .filter((key) => !TEMPLATED.some((prefix) => key.startsWith(prefix)))
    .filter((key) => !corpus.includes(key))
    .map((key) => ({ path: ar.path, line: 1, detail: `"${key}" has no reader` }));

  assert.equal(
    findings.length,
    0,
    `${report(findings, "dead translation keys")}\n\nDelete them, or use them. A dictionary is not an archive.`,
  );
});

/**
 * The domains a key can belong to. A literal shaped like a key and prefixed
 * with one of these is a key — wherever it was written.
 *
 * This is what catches the failure the panel cannot: an API error code or a zod
 * message that no dictionary entry answers. Those never pass through `t("…")`
 * in the file that emits them, so a call-site-only check misses them entirely,
 * and the first sign of trouble is a user reading `repo.branchEmpty`.
 */
const KEY_DOMAINS = [
  "action.",
  "auth.",
  "delivery.",
  "dossier.",
  "error.",
  "member.",
  "model.",
  "overview.",
  "prompt.",
  "recon.",
  "repos.",
  "rules.",
  "settings.",
  "state.",
  "front.",
  "manual.",
];

test("every key the code asks for exists in the dictionary", () => {
  const ar = dictionary("ar");
  assert.ok(ar);

  const known = new Set(keysOf(ar.text));
  const findings: Finding[] = [];
  const pattern = /"([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)"/g;

  for (const file of sources()) {
    if (file.path.includes("/i18n/") || isTest(file)) continue;
    for (let m = pattern.exec(file.text); m; m = pattern.exec(file.text)) {
      const key = m[1] ?? "";
      if (!KEY_DOMAINS.some((domain) => key.startsWith(domain))) continue;
      if (!known.has(key)) {
        findings.push({ path: file.path, line: lineOf(file.text, m.index), detail: `"${key}"` });
      }
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "missing translation keys")}\n\nThis renders the raw key to a user.`,
  );
});
