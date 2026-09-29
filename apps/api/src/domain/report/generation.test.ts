/**
 * What a failed generation leads to. It once led to a fallback sentence sent
 * at once, where a report was awaited (0012): now nothing is sent, the outbox
 * retries what waiting can mend, and the row keeps why.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { afterGeneration, llmOutcome, withRewrite } from "@/domain/report/generation.js";

test("afterGeneration: a written report is sent", () => {
  assert.deepEqual(afterGeneration({ llmOk: true, llmError: null, llmRetryable: false }), { send: true, reason: "ok" });
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

test("afterGeneration: a digest goes out on its measured facts when the prose fails, and says so", () => {
  // The weekly digest's facts are its report; the model only phrases them. Held
  // like a push report, a 429 kept the whole week from the channel.
  assert.deepEqual(afterGeneration({ llmOk: false, llmError: "openrouter 429", llmRetryable: true, proseOptional: true }), {
    send: true,
    reason: "llm_failed",
  });
  assert.deepEqual(afterGeneration({ llmOk: true, llmError: null, llmRetryable: false, proseOptional: true }), { send: true, reason: "ok" });
});

test("afterGeneration: the wait the provider asked for is kept, for the outbox to honour", () => {
  // OpenRouter: "Respect the Retry-After header before retrying" (api-reference/errors).
  assert.deepEqual(afterGeneration({ llmOk: false, llmError: "openrouter 429", llmRetryable: true, llmRetryAfterSeconds: 60 }), {
    send: false,
    reason: "llm_held",
    error: "openrouter 429",
    retryable: true,
    retryAfterSeconds: 60,
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

test("llmOutcome: a refusal keeps its reason and the wait it asked for; an answer keeps nothing of the kind", () => {
  assert.deepEqual(llmOutcome({ ok: false, error: "openrouter 429", retryable: true, retryAfterSeconds: 60 }), {
    llmOk: false,
    llmError: "openrouter 429",
    llmRetryable: true,
    llmRetryAfterSeconds: 60,
    llmFailure: null,
  });
  assert.equal(llmOutcome({ ok: false, error: "timeout", retryable: true }).llmRetryAfterSeconds, null);
  assert.deepEqual(llmOutcome({ ok: true }), { llmOk: true, llmError: null, llmRetryable: false, llmRetryAfterSeconds: null, llmFailure: null });
});

test("the provider's own fields reach the row that was held, as they came", () => {
  const failure = { provider: "openrouter", status: 429, message: "Provider returned error", upstream: "Google AI Studio" };
  const outcome = llmOutcome({ ok: false, error: "openrouter 429", retryable: true, failure });

  assert.deepEqual(outcome.llmFailure, failure);
  assert.deepEqual(afterGeneration({ ...outcome }), {
    send: false,
    reason: "llm_held",
    error: "openrouter 429",
    retryable: true,
    detail: failure,
  });
});
