/**
 * apps/web/CONSTITUTION.md §2 (the visual identity) and §3 (RTL).
 *
 * The two-layer token system only works if nothing outside it invents a value.
 * One component with a hard-coded colour breaks light mode; one `margin-left`
 * breaks Arabic. Neither shows up in review, because both look correct in the
 * theme and direction the author happened to be using.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { allSources, isStyle, lineOf, report, under, type Finding } from "../lib/sources.ts";

/**
 * The identity layer: the only files allowed to hold raw values.
 *
 * Two files, because the layer is two halves — tokens.css holds the primitives
 * and scales, themes.css maps them to meaning per theme and composes the alpha
 * washes that have no primitive of their own. See apps/web/CONSTITUTION.md §2.
 */
const IDENTITY_LAYER = [
  "apps/web/src/styles/tokens.css",
  "apps/web/src/styles/themes.css",
];

/** Strips comments only; CSS has no strings worth protecting here. */
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function styleFiles() {
  return allSources().filter((file) => isStyle(file) && !IDENTITY_LAYER.includes(file.path));
}

test("no colour literal outside the token file", () => {
  const findings: Finding[] = [];
  // Hex, rgb()/hsl() with numbers. `currentColor` and `transparent` are keywords
  // that carry no palette decision, so they are not literals in this sense.
  const pattern = /#[0-9a-f]{3,8}\b|\b(rgb|hsl)a?\(\s*\d/gi;

  for (const file of styleFiles()) {
    const css = stripComments(file.text);
    for (let m = pattern.exec(css); m; m = pattern.exec(css)) {
      findings.push({ path: file.path, line: lineOf(css, m.index), detail: m[0] });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "apps/web/CONSTITUTION.md §2")}\n\nConsume a semantic token: var(--color-*).`,
  );
});

test("no px and no font stack outside the token file", () => {
  const findings: Finding[] = [];
  // `font-family: var(--font-mono)` is the correct way to ask for the mono
  // stack; only naming actual typefaces is inventing identity.
  const pattern = /(?<![\w-])-?\d*\.?\d+px\b|font-family\s*:(?!\s*var\()/g;

  for (const file of styleFiles()) {
    const css = stripComments(file.text);
    for (let m = pattern.exec(css); m; m = pattern.exec(css)) {
      findings.push({ path: file.path, line: lineOf(css, m.index), detail: m[0] });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "apps/web/CONSTITUTION.md §2")}\n\nSizes are rem; every scale value is a token.`,
  );
});

test("no primitive palette token is read outside the token file", () => {
  const findings: Finding[] = [];
  const pattern = /var\(\s*--palette-/g;

  for (const file of styleFiles()) {
    const css = stripComments(file.text);
    for (let m = pattern.exec(css); m; m = pattern.exec(css)) {
      findings.push({ path: file.path, line: lineOf(css, m.index), detail: "reads a primitive" });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "apps/web/CONSTITUTION.md §2")}\n\nA primitive is correct in one theme only.`,
  );
});

test("direction is expressed logically, never by a [dir=rtl] rule", () => {
  const findings: Finding[] = [];
  const physical = /(margin|padding|border)-(left|right)\s*:|(?<![-\w])(left|right)\s*:\s*(?!auto)|text-align\s*:\s*(left|right)/g;

  for (const file of styleFiles()) {
    const css = stripComments(file.text);

    // The single documented exception (apps/web/CONSTITUTION.md §3): the toggle
    // thumb's travel has no logical form, so its direction is a variable. Matched
    // narrowly — the whole rule, not the selector — so any OTHER [dir=rtl] rule,
    // including a second declaration inside this one, still fails.
    const FLIP_EXCEPTION = /\[dir="rtl"\]\s*\{\s*--flip:\s*-1;\s*\}/;
    const withoutException = css.replace(FLIP_EXCEPTION, (m) => m.replace(/[^\n]/g, " "));

    const dirRule = /\[dir=["']?rtl/g;
    for (let m = dirRule.exec(withoutException); m; m = dirRule.exec(withoutException)) {
      findings.push({
        path: file.path,
        line: lineOf(withoutException, m.index),
        detail: "a new [dir=rtl] rule",
      });
    }

    for (let m = physical.exec(css); m; m = physical.exec(css)) {
      findings.push({ path: file.path, line: lineOf(css, m.index), detail: `physical: ${m[0].trim()}` });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "apps/web/CONSTITUTION.md §3")}\n\nUse margin-inline-start, inset-inline-start, text-align: start.`,
  );
});

/**
 * apps/web/CONSTITUTION.md §7: `aria-current` marks the navigation item you are
 * *on*. Selecting a row of a list is `aria-pressed` or a listbox.
 *
 * Checked by value rather than by location, because the tell is unmistakable:
 * navigation says `aria-current="page"`, and anything else means the attribute
 * was reached for as a generic "this one is selected". It reads correctly, it
 * renders correctly, and it tells a screen reader the user has navigated
 * somewhere they have not.
 */
test("aria-current marks a page, never a selection", () => {
  const findings: Finding[] = [];
  const pattern = /aria-current\s*=\s*(?:"([^"]*)"|\{([^}]*)\})/g;

  for (const file of allSources()) {
    const text = isStyle(file) ? stripComments(file.text) : file.text;
    for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
      const value = m[1] ?? m[2] ?? "";
      if (value.includes("page")) continue;
      findings.push({ path: file.path, line: lineOf(text, m.index), detail: m[0].slice(0, 48) });
    }
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "apps/web/CONSTITUTION.md §7")}\n\nUse aria-pressed for a selected row, or a listbox for a set of them.`,
  );
});

test("no inline style carries an identity value", () => {
  const findings: Finding[] = [];
  // A style object mentioning a colour, a px value, a font — or *reading a
  // token* — is putting identity in a component. Reaching for `var(--space-6)`
  // inline is the subtle one: the value is correct, but it belongs to a class
  // that was never written, and the next person copies the inline instead.
  //
  // Widths computed from data stay legal: a meter's fill is a proportion, not a
  // token, and there is no class that can express it.
  const pattern =
    /style=\{\{[^}]*(#[0-9a-f]{3,8}|\d+px|font-family|color\s*:|var\(--)[^}]*\}\}/gi;

  for (const file of under("apps/web/src/")) {
    for (let m = pattern.exec(file.text); m; m = pattern.exec(file.text)) {
      findings.push({
        path: file.path,
        line: lineOf(file.text, m.index),
        detail: m[0].slice(0, 60),
      });
    }
  }

  assert.equal(findings.length, 0, report(findings, "apps/web/CONSTITUTION.md §2 (no inline identity)"));
});
