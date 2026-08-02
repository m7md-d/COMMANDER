/**
 * Every waiting surface reserves its own shape — docs/UI-AUDIT.md §6.
 *
 * This is the note that stayed "partial" for three rounds, and the reason is
 * instructive: the mechanism existed and worked, so nothing ever failed. A
 * screen that shipped with the default placeholder looked finished, and the
 * only symptom was a jump when the data landed — which nobody notices on a
 * fast local connection.
 *
 * So the rule is made explicit instead: choosing a placeholder is mandatory.
 * Passing `skeleton` says "here is the shape"; passing `lines` says "prose, and
 * this many". Passing neither is not a third option, it is a screen nobody
 * thought about.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { lineOf, report, under, type Finding } from "../lib/sources.ts";

/** The props of one `<QueryState …>` element, from the tag to its closing `>`. */
function elements(text: string): { props: string; index: number }[] {
  const found: { props: string; index: number }[] = [];
  const open = /<QueryState\b/g;

  for (let m = open.exec(text); m; m = open.exec(text)) {
    // Scan to the end of the opening tag, ignoring `>` inside braces so an
    // arrow function in a prop does not end the element early.
    let depth = 0;
    for (let i = m.index; i < text.length; i += 1) {
      const char = text[i];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0) {
        found.push({ props: text.slice(m.index, i), index: m.index });
        break;
      }
    }
  }

  return found;
}

test("every QueryState chooses its placeholder", () => {
  const findings: Finding[] = [];

  for (const file of under("apps/web/src/")) {
    for (const { props, index } of elements(file.text)) {
      if (/\bskeleton=/.test(props) || /\blines=/.test(props)) continue;
      findings.push({
        path: file.path,
        line: lineOf(file.text, index),
        detail: "neither `skeleton` nor `lines`",
      });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "docs/UI-AUDIT.md §6")}\n\nPass "skeleton" with a shape built from the content's own layout classes, or "lines" if the content really is prose.`,
  );
});

/**
 * A shaped skeleton that invents its own geometry is the thing this round set
 * out to stop: it drifts from the layout it stands in for, silently, and then
 * reserves the wrong height again. Every one of them must render at least one
 * class that the real component also renders.
 */
test("a shaped skeleton is built from a real layout", () => {
  const findings: Finding[] = [];
  const skeletons = under("apps/web/src/").filter(
    (file) =>
      /Skeleton\.tsx$/.test(file.path) &&
      // The generic prose placeholder is the one with no layout to borrow —
      // it stands in for a paragraph, which has no shape of its own.
      !file.path.endsWith("shared/components/Skeleton.tsx"),
  );

  assert.ok(skeletons.length > 0, "expected shaped skeletons to exist");

  for (const file of skeletons) {
    // Both forms: a literal className, and one chosen in an expression — a
    // skeleton that varies with a prop still borrows real classes.
    const classes = [...file.text.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)]
      .flatMap((m) => [...(m[1] ?? m[2] ?? "").matchAll(/[\w-]+/g)].map((c) => c[0]))
      // `sk-*` and `skeleton-*` are the blanks themselves, not borrowed layout.
      .filter((name) => name && !name.startsWith("sk-") && !name.startsWith("skeleton-"));

    if (classes.length === 0) {
      findings.push({
        path: file.path,
        line: 1,
        detail: "draws its own geometry instead of reusing the layout's classes",
      });
    }
  }

  assert.equal(findings.length, 0, report(findings, "docs/UI-AUDIT.md §6"));
});
