import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AR, EN } from "@commander/shared";

test("the arrow from a charge to its answerer points the way the line is read (W-15)", () => {
  // One literal "←" served both directions: in English, read left to right,
  // "Force push ← m7md-d" pointed back at the rule.
  const report = readFileSync(new URL("./components/DeliveryReport.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(report, /[←→]/, "the arrow is a dictionary entry, one per direction");
  assert.match(report, /t\("dispatch\.chargedTo"\)/);
  assert.equal(AR["dispatch.chargedTo"], "←");
  assert.equal(EN["dispatch.chargedTo"], "→");
});
