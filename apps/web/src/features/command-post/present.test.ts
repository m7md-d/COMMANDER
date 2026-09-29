import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { OverviewStats } from "@commander/shared";
import { retryFor, toReadout } from "./present";

/** Echoes the key, so a test reads which string a row asked for. */
const keyOf = (key: string): string => key;

const STATS: OverviewStats = {
  repositoryCount: 3,
  memberCount: 5,
  pushCount: 134,
  violationCount: 31,
  pendingDeliveries: 0,
  failedDeliveries: 2,
};

test("the queue figure is named as the queue, not as every dispatch (W-02)", () => {
  // The headquarters said "dispatches 000" beside six dispatches on record:
  // the figure is what waits in the queue, under the name of the dispatches page.
  const pending = toReadout(STATS, keyOf).find((row) => row.key === "pending");

  assert.equal(pending?.value, 0);
  assert.equal(pending?.label, "overview.pendingDeliveries");
});

test("a screen offers no retry to a visitor who is not signed in (W-17)", () => {
  // The public headquarters asks for data it is not allowed to read: a 401,
  // every time. "Retry" beside it could never change that.
  const refetch = () => undefined;

  assert.equal(retryFor({ status: 401 }, refetch), undefined);
  assert.equal(retryFor({ status: 503 }, refetch), refetch);
  assert.equal(retryFor(new Error("network"), refetch), refetch);
  assert.equal(retryFor(null, refetch), refetch);
});

test("the headquarters asks retryFor before it offers a retry", () => {
  const page = readFileSync(new URL("../../pages/HeadquartersPage.tsx", import.meta.url), "utf8");
  assert.match(page, /onRetry=\{retryFor\(/);
});
