/**
 * How long the panel waits on the server.
 *
 * Deliberately a *smoke* budget, not a benchmark: it runs against whatever
 * stack is up, and its job is to catch a route that has become pathological —
 * an N+1 that arrived with a new column, a missing index — not to measure
 * milliseconds on a laptop under docker.
 *
 * When nothing is listening the tests skip rather than fail. A latency check
 * that needs infrastructure must not turn `npm run verify` into something that
 * only passes on one machine; the bundle budget above is the one that always
 * runs. The skip is loud so it is never mistaken for a pass.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { RESPONSE_MS } from "../lib/budgets.ts";

const BASE = process.env.PANEL_URL ?? "http://localhost:8080";

async function reachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1_000);
    await fetch(`${BASE}/api/auth/session`, { signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch {
    // Nothing listening, or DNS/connection refused. Not a failure of the code
    // under test — the caller is told, and the suite moves on.
    return false;
  }
}

/** Median of a few samples: one cold call measures the process waking up. */
async function medianMs(path: string, samples = 5): Promise<number> {
  const timings: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const started = performance.now();
    await fetch(`${BASE}${path}`);
    timings.push(performance.now() - started);
  }
  return timings.sort((a, b) => a - b)[Math.floor(samples / 2)] ?? 0;
}

test("the session check answers within budget", async (t) => {
  if (!(await reachable())) {
    t.skip(`no panel at ${BASE} — start the stack, or set PANEL_URL, to measure latency`);
    return;
  }

  const ms = await medianMs("/api/auth/session");
  assert.ok(ms <= RESPONSE_MS.session, `session took ${ms.toFixed(0)}ms, budget ${RESPONSE_MS.session}ms`);
});

test("an unauthenticated list rejects within budget", async (t) => {
  if (!(await reachable())) {
    t.skip(`no panel at ${BASE} — start the stack, or set PANEL_URL, to measure latency`);
    return;
  }

  // Unauthenticated on purpose: this measures routing, middleware and the auth
  // check without needing a session, which keeps the guard free of credentials.
  const ms = await medianMs("/api/repositories");
  assert.ok(ms <= RESPONSE_MS.list, `list took ${ms.toFixed(0)}ms, budget ${RESPONSE_MS.list}ms`);
});
