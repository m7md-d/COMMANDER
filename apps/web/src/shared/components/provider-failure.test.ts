import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("a refusal shows its sentences, and the raw reply only behind the setting's button", () => {
  // The owner's decision (2026-09-30): a human sentence and real times first;
  // the provider's reply field by field behind a button, which exists only when
  // `rawFailures` is on in settings — off by default.
  const card = readFileSync(new URL("./ProviderFailure.tsx", import.meta.url), "utf8");

  assert.match(card, /failureSummary\(detail\)/);
  assert.match(card, /settings\.data\?\.rawFailures/);
  assert.match(card, /\{allowed && shown \? \(\s*<dl/);
});
