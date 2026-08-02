/**
 * The legacy path is the one that matters. Rows written before occasions existed
 * are sitting in the queue at the moment of deploy, and a reader that dropped
 * them would lose exactly the reports the outbox exists to protect.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readOccasion } from "./occasion.js";

test("a stored occasion is read back as itself", () => {
  const digest = {
    kind: "weekly_digest",
    repositoryId: "r1",
    repoFullName: "owner/repo",
    since: "2026-07-20T00:00:00.000Z",
    until: "2026-07-27T00:00:00.000Z",
  };

  assert.deepEqual(readOccasion(digest), digest);
});

test("a payload written before occasions existed is still a push", () => {
  const legacy = { repoFullName: "owner/repo", branch: "main", commits: [] };
  const occasion = readOccasion(legacy);

  assert.equal(occasion?.kind, "push");
  assert.deepEqual(occasion?.kind === "push" ? occasion.push : null, legacy);
});

/**
 * Recognised by the field every push carries, not by "it has no kind" — the
 * latter would also accept junk and hand a malformed row to the pipeline as if
 * it were work.
 */
test("something that is neither is refused rather than guessed at", () => {
  assert.equal(readOccasion(null), null);
  assert.equal(readOccasion("push"), null);
  assert.equal(readOccasion({}), null);
  assert.equal(readOccasion({ kind: "quarterly" }), null);
  assert.equal(readOccasion({ branch: "main" }), null);
});
