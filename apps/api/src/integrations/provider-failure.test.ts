/**
 * What a provider says when it refuses, read into one shape. Each fixture is a
 * response the provider documents (links beside each), because a 429 alone
 * named nothing: OpenRouter's free daily quota, its per-minute limit, and an
 * upstream provider throttling a free model all arrive as 429, and only the
 * body and headers tell them apart (docs/DEFECTS.md D-32).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { describeFailure, failureDetail, readNetworkFailure } from "@/integrations/provider-failure.js";
import { readOpenRouterFailure } from "@/integrations/openrouter/openrouter.errors.js";
import { readDiscordFailure } from "@/integrations/discord/discord.errors.js";
import { readGitHubFailure } from "@/integrations/github/github.errors.js";

const answer = (status: number, headers: Record<string, string>, body: unknown) => ({
  status,
  header: (name: string) => headers[name.toLowerCase()] ?? null,
  text: typeof body === "string" ? body : JSON.stringify(body),
});

// https://openrouter.ai/docs/api-reference/errors — the typed example.
test("OpenRouter: a typed rate limit keeps its error_type, provider code and Retry-After", () => {
  const failure = readOpenRouterFailure(
    answer(429, { "retry-after": "60" }, { error: { code: 429, message: "Rate limit exceeded", metadata: { error_type: "rate_limit_exceeded", provider_code: "rate_limited" } } }),
  );

  assert.deepEqual(failure, {
    provider: "openrouter",
    status: 429,
    code: "rate_limit_exceeded",
    message: "Rate limit exceeded",
    upstream: null,
    detail: "rate_limited",
    retryAfterSeconds: 60,
    quota: null,
  });
});

// https://openrouter.ai/docs/api-reference/limits — the free quota, with its headers.
test("OpenRouter: the free daily quota names itself, with the limit, what is left and when it resets", () => {
  const failure = readOpenRouterFailure(
    answer(
      429,
      { "x-ratelimit-limit": "50", "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1790640000000" },
      { error: { code: 429, message: "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day" } },
    ),
  );

  assert.equal(failure.message, "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day");
  assert.deepEqual(failure.quota, { limit: "50", remaining: "0", reset: "1790640000000" });
});

test("OpenRouter: an upstream provider throttling a free model is named, with its own words", () => {
  const raw = "google/gemma-4-26b-a4b-it:free is temporarily rate-limited upstream. Please retry shortly.";
  const failure = readOpenRouterFailure(
    answer(429, {}, { error: { code: 429, message: "Provider returned error", metadata: { raw, provider_name: "Google AI Studio" } } }),
  );

  assert.equal(failure.upstream, "Google AI Studio");
  assert.equal(failure.detail, raw);
});

test("OpenRouter: quota headers carried inside the body are read like real ones", () => {
  const failure = readOpenRouterFailure(
    answer(429, {}, { error: { code: 429, message: "Rate limit exceeded", metadata: { headers: { "X-RateLimit-Limit": "20", "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1790600060000" } } } }),
  );

  assert.deepEqual(failure.quota, { limit: "20", remaining: "0", reset: "1790600060000" });
});

test("OpenRouter: a moderation refusal gives its reasons", () => {
  const failure = readOpenRouterFailure(
    answer(403, {}, { error: { code: 403, message: "Input was flagged", metadata: { reasons: ["harassment"], flagged_input: "…", provider_name: "OpenAI", model_slug: "openai/gpt-4o" } } }),
  );

  assert.equal(failure.detail, "harassment");
  assert.equal(failure.upstream, "OpenAI");
});

test("a body that is not JSON — a proxy's HTML page — keeps its status and the start of its text", () => {
  const failure = readOpenRouterFailure(answer(503, {}, "<html><body>Service Unavailable</body></html>"));

  assert.equal(failure.status, 503);
  assert.match(failure.message, /Service Unavailable/);
  assert.equal(failure.code, null);
});

// https://docs.discord.com/developers/topics/rate-limits and opcodes-and-status-codes
test("Discord: a rate limit keeps its retry_after, whether global, and its scope", () => {
  const failure = readDiscordFailure(
    answer(429, { "x-ratelimit-scope": "shared", "retry-after": "2" }, { message: "You are being rate limited.", retry_after: 1.5, global: false }),
  );

  assert.equal(failure.retryAfterSeconds, 2, "the larger of body and header, rounded up");
  assert.equal(failure.detail, "shared");
});

test("Discord: a deleted webhook is its JSON code, not a bare 404", () => {
  const failure = readDiscordFailure(answer(404, {}, { message: "Unknown Webhook", code: 10015 }));

  assert.deepEqual([failure.status, failure.code, failure.message], [404, "10015", "Unknown Webhook"]);
});

// https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
test("GitHub: an exhausted primary limit names its resource and reset", () => {
  const failure = readGitHubFailure(
    answer(
      403,
      { "x-ratelimit-limit": "5000", "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1790600000", "x-ratelimit-resource": "core" },
      { message: "API rate limit exceeded for installation ID 1.", documentation_url: "https://docs.github.com/rest/overview/rate-limits-for-the-rest-api", status: "403" },
    ),
  );

  assert.equal(failure.code, "core");
  assert.deepEqual(failure.quota, { limit: "5000", remaining: "0", reset: "1790600000" });
  assert.match(failure.message, /API rate limit exceeded/);
});

test("describeFailure: one line an operator can act on", () => {
  const line = describeFailure({
    provider: "openrouter",
    status: 429,
    code: "rate_limit_exceeded",
    message: "Provider returned error",
    upstream: "Google AI Studio",
    detail: "temporarily rate-limited upstream",
    retryAfterSeconds: 60,
    quota: { limit: "50", remaining: "0", reset: "1790640000000" },
  });

  assert.equal(line, "openrouter 429 rate_limit_exceeded · Google AI Studio · Provider returned error — temporarily rate-limited upstream · quota 0/50, resets 1790640000000 · retry after 60s");
});

// Node's fetch (undici) throws "TypeError: fetch failed" and keeps the reason in `cause`.
test("readNetworkFailure: a failed fetch keeps the reason its cause holds", () => {
  const error = Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) });

  assert.deepEqual(readNetworkFailure("openrouter", error, { elapsedMs: 812, answered: null }), {
    provider: "openrouter",
    status: 0,
    code: "ECONNRESET",
    message: "fetch failed",
    upstream: null,
    detail: "read ECONNRESET · after 812ms",
    retryAfterSeconds: null,
    quota: null,
  });
});

test("readNetworkFailure: an abort says how long it waited, and whether an answer had begun", () => {
  const abort = Object.assign(new Error("This operation was aborted"), { name: "AbortError" });

  const silent = readNetworkFailure("openrouter", abort, { elapsedMs: 60000, answered: null });
  assert.deepEqual([silent.status, silent.code, silent.detail], [0, "timeout", "no response headers · after 60000ms"]);

  const started = readNetworkFailure("openrouter", abort, { elapsedMs: 60000, answered: { status: 200, afterMs: 4100 } });
  assert.deepEqual([started.status, started.code, started.detail], [200, "timeout", "headers 200 after 4100ms, body incomplete · after 60000ms"]);
});

test("failureDetail: the fields a delivery row keeps, flat, with nothing invented for what was not sent", () => {
  assert.deepEqual(
    failureDetail({
      provider: "openrouter",
      status: 429,
      code: "rate_limit_exceeded",
      message: "Provider returned error",
      upstream: "Google AI Studio",
      detail: null,
      retryAfterSeconds: null,
      quota: { limit: "50", remaining: "0", reset: null },
    }),
    { provider: "openrouter", status: 429, code: "rate_limit_exceeded", message: "Provider returned error", upstream: "Google AI Studio", quotaLimit: "50", quotaRemaining: "0" },
  );
});
