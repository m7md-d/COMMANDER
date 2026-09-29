import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("`.ltr` isolates what it marks, so a login or a code cannot trade places with the Arabic around it (W-05)", () => {
  // `direction` alone does nothing to an inline box: without `unicode-bidi` the
  // span still takes part in its paragraph's reordering. "دفع مباشر بدون PR ←
  // lina-dev" came out as "PR ← lina-dev دفع مباشر بدون".
  const css = readFileSync(new URL("./base.css", import.meta.url), "utf8");
  const start = css.indexOf(".ltr {");
  const rule = css.slice(start, css.indexOf("}", start));

  assert.ok(start !== -1, "base.css: no `.ltr` rule");
  assert.match(rule, /unicode-bidi:\s*isolate/);
});
