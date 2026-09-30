import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DIR = new URL("./", import.meta.url);
const SHEETS = readdirSync(DIR).filter((name) => name.endsWith(".css") && name !== "tokens.css");
const SCALED = /^calc\(-?[\d.]+em \* var\(--tracking\)\)$/;

test("every letter-spacing is scaled by --tracking, so Arabic can switch it off (W-18)", () => {
  // Tracking was written for upper-case Latin labels and fell on Arabic as it
  // was: "الجبهات" on the headquarters screen read with a gap between letters
  // (1.68px measured on a readout label). A spaced Arabic word is a broken one.
  const findings: string[] = [];
  for (const sheet of SHEETS) {
    const css = readFileSync(new URL(sheet, DIR), "utf8");
    for (const [, value = ""] of css.matchAll(/letter-spacing:\s*([^;]+);/g)) {
      if (!SCALED.test(value.trim())) findings.push(`${sheet}: letter-spacing: ${value}`);
    }
  }
  assert.deepEqual(findings, [], "write `calc(<n>em * var(--tracking))`");
});

test("Arabic zeroes the tracking scale (W-18)", () => {
  const tokens = readFileSync(new URL("tokens.css", DIR), "utf8");
  assert.match(tokens, /--tracking:\s*1;/);
  assert.match(tokens, /:root:lang\(ar\)\s*\{\s*--tracking:\s*0;\s*\}/);
});
