import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("each check's excluded patterns are folded until opened (UI-DEFECTS observations)", () => {
  // The same ten shipped exclusions stood under every metric, open, and made the
  // rules tab 4,200 pixels tall. Folded, the count still says they are there.
  const fields = readFileSync(new URL("./components/CheckFields.tsx", import.meta.url), "utf8");

  assert.match(fields, /<details className="clause-fold">[\s\S]*checks\.exclude[\s\S]*<\/details>/);
});
