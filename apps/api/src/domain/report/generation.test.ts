/**
 * What a failed generation leads to. It once led to a fallback sentence sent
 * at once, where a report was awaited (0012): now nothing is sent, the outbox
 * retries what waiting can mend, and the row keeps why.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { afterGeneration, withRewrite } from "@/domain/report/generation.js";

test("afterGeneration: a written report is sent", () => {
  assert.deepEqual(afterGeneration({ llmOk: true, llmError: null, llmRetryable: false }), { send: true });
});

test("afterGeneration: a failed one is never replaced — retried when waiting can mend it, held otherwise", () => {
  assert.deepEqual(afterGeneration({ llmOk: false, llmError: "http_429", llmRetryable: true }), {
    send: false,
    reason: "llm_held",
    error: "http_429",
    retryable: true,
  });
  assert.deepEqual(afterGeneration({ llmOk: false, llmError: "http_401", llmRetryable: false }), {
    send: false,
    reason: "llm_held",
    error: "http_401",
    retryable: false,
  });
});

test("withRewrite: a report asked for again says so, and quotes the one sent", () => {
  const prompt = withRewrite("FACTS", { locale: "ar", previous: "سارة، <wip> ليست رسالة" });

  assert.ok(prompt.startsWith("FACTS\n\n"), "the facts are the same facts");
  assert.match(prompt, /أُرسل من قبل/);
  assert.match(prompt, /سارة، wip ليست رسالة/, "the model's own text, stripped of what could close a tag");
});

test("withRewrite: a first report is left as it was", () => {
  assert.equal(withRewrite("FACTS", { locale: "ar", previous: null }), "FACTS");
});
