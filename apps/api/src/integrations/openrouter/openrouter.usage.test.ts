/**
 * The token reading has to stay distinguishable from its own absence.
 *
 * It exists to answer one question — how many tokens does a prompt of N
 * characters actually cost on this model — and that question is only answerable
 * from real readings. A zero folded in as though it were measured drags the
 * ratio toward a number nobody observed, which is the failure this project
 * refuses everywhere else: a confident wrong answer in place of a stated gap.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readUsage } from "@/integrations/openrouter/openrouter.usage.js";

test("a reported cost is read as given", () => {
  assert.deepEqual(readUsage({ usage: { prompt_tokens: 8_412, completion_tokens: 320 } }), {
    promptTokens: 8_412,
    completionTokens: 320,
  });
});

test("an upstream that reports no usage yields null, never a zero", () => {
  assert.equal(readUsage({}), null);
  assert.equal(readUsage({ usage: {} }), null);
  assert.equal(readUsage({ usage: { completion_tokens: 40 } }), null, "a cost with no prompt half is not a reading");
});

test("a zero or nonsense prompt count is an absence, not a measurement", () => {
  assert.equal(readUsage({ usage: { prompt_tokens: 0 } }), null);
  assert.equal(readUsage({ usage: { prompt_tokens: Number.NaN } }), null);
  assert.equal(readUsage({ usage: { prompt_tokens: -5 } }), null);
});

test("a missing completion half does not discard the prompt half", () => {
  // The prompt count is the one the budget question needs; losing a whole
  // reading because the other half is absent would throw away the answer.
  assert.deepEqual(readUsage({ usage: { prompt_tokens: 1_200 } }), {
    promptTokens: 1_200,
    completionTokens: 0,
  });
});
