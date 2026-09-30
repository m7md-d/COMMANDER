import { test } from "node:test";
import assert from "node:assert/strict";
import { failureSummary, resetInstant } from "./failureSummary";

/** Echoes the key and its variables, so a test reads which sentence was asked for. */
const keysOf = (detail: Record<string, string | number>) => failureSummary(detail).map((line) => line.key);

test("a refusal reads as one human sentence first, by what the status says (UI-DEFECTS observations)", () => {
  assert.deepEqual(keysOf({ provider: "openrouter", status: 429 }), ["failure.says.rateLimited"]);
  assert.deepEqual(keysOf({ provider: "openrouter", status: 402 }), ["failure.says.credits"]);
  assert.deepEqual(keysOf({ provider: "discord", status: 401 }), ["failure.says.denied"]);
  assert.deepEqual(keysOf({ provider: "discord", status: 404 }), ["failure.says.notFound"]);
  assert.deepEqual(keysOf({ provider: "github", status: 503 }), ["failure.says.serverError"]);
  assert.deepEqual(keysOf({ provider: "openrouter", status: 0 }), ["failure.says.unreachable"]);
  assert.deepEqual(keysOf({ provider: "openrouter", status: 400 }), ["failure.says.refused"]);
});

test("the wait and the quota's renewal are said as times, not as raw numbers", () => {
  const lines = failureSummary({ provider: "openrouter", status: 429, upstream: "Chutes", retryAfterSeconds: 30, quotaReset: "1790726400000" });

  assert.deepEqual(lines.map((line) => line.key), ["failure.says.rateLimited", "failure.says.upstream", "failure.says.retryAfter", "failure.says.resets"]);
  assert.equal(lines[3]?.at, "2026-09-30T00:00:00.000Z");
});

test("a reset is read in milliseconds or in seconds, whichever the provider sent", () => {
  assert.equal(resetInstant("1790726400000")?.toISOString(), "2026-09-30T00:00:00.000Z");
  assert.equal(resetInstant(1790726400)?.toISOString(), "2026-09-30T00:00:00.000Z");
  assert.equal(resetInstant("soon"), null);
});
