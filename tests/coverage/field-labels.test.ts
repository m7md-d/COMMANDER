/**
 * Every `<Field>` hands its control the id its label points at.
 *
 * `Field` generates the id and binds its `<label htmlFor>` to it (CONSTITUTION
 * §7); the render function it calls receives that id. Written `{() => …}`, the
 * id is dropped: the label is bound to nothing, and a screen reader reads the
 * control with no name. Two copy fields shipped that way — the webhook URL on a
 * front's file and on the setup page (docs/UI-DEFECTS.md W-12) — and axe caught
 * them as critical. A group of controls, which a <label> cannot name, takes the
 * id too: `Field` names it through `aria-labelledby`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { codeOnly, isTest, lineOf, report, under, type Finding } from "../lib/sources.js";

/** `<Field …>` then, before its first child, a render function with no parameter. */
const DROPPED = /<Field\b[^>]*>\s*\{\s*\(\s*\)\s*=>/g;

test("every Field passes its id to the control it labels", () => {
  const findings: Finding[] = [];

  for (const file of under("apps/web/src/")) {
    if (isTest(file)) continue;
    const code = codeOnly(file.text);
    for (const match of code.matchAll(DROPPED)) {
      findings.push({ path: file.path, line: lineOf(code, match.index), detail: "render function drops the id" });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "apps/web/CONSTITUTION.md §7")}\n\nWrite \`{(id) => <Control id={id} … />}\`. A group of controls takes \`aria-labelledby={labelOf(id)}\` (Field.tsx).`,
  );
});
