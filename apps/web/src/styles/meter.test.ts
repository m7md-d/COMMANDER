import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** The declarations of one rule, by its exact selector. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start !== -1, `dossier.css: no \`${selector}\` rule — if it moved, point this test at it`);
  return css.slice(start, css.indexOf("}", start));
}

test("a meter's bar is a box, so its width is drawn (W-04)", () => {
  // The fill is a <span>. Inline, it ignores inline-size and block-size: every
  // bar in the dossier, the survey and the tree was an empty track beside its
  // figure. The track is a <span> too, and was drawn only where a grid happened
  // to make it a block.
  const css = readFileSync(new URL("./dossier.css", import.meta.url), "utf8");

  assert.match(rule(css, ".meter-fill"), /display:\s*block/);
  assert.match(rule(css, ".meter-track"), /display:\s*block/);
});
