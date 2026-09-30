/**
 * Who pushed what the reconciler found (D-22): the gap split by the pushes
 * GitHub's events timeline shows, and nobody named where it shows none.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { CommitListEntry } from "@/integrations/github/commits.client.js";
import { recoveredPush } from "@/queue/reconciler.mapper.js";
import type { PushEventEntry } from "@/integrations/github/events.client.js";
import { eventsToRead, pushedBy, splitByPusher } from "@/queue/reconciler.pushers.js";

const entry = (sha: string): CommitListEntry => ({ sha, url: "", title: "wip", timestamp: "2026-09-30T10:00:00Z", authorLogin: "sara", committerLogin: "sara" });
const GAP = ["a", "b", "c", "d"].map(entry);
const shape = (parts: ReturnType<typeof splitByPusher>) => parts.map((part) => [part.pusher, part.commits.map((commit) => commit.sha).join("")]);

test("each push the timeline shows is its own part, named by who made it", () => {
  const parts = splitByPusher(GAP, [
    { pusher: "lina", shas: ["a", "b"] },
    { pusher: "lina", shas: ["c", "d"] },
  ]);

  // Two pushes by one person stay two: a push's size is charged per push.
  assert.deepEqual(shape(parts), [["lina", "ab"], ["lina", "cd"]]);
});

test("what no event accounts for is one push naming nobody", () => {
  assert.deepEqual(shape(splitByPusher(GAP, [])), [[null, "abcd"]]);
  assert.deepEqual(shape(splitByPusher(GAP, [{ pusher: "omar", shas: ["c", "d"] }])), [[null, "ab"], ["omar", "cd"]]);
});

test("a push reaching outside the gap, or into one already taken, names nobody", () => {
  assert.deepEqual(shape(splitByPusher(GAP, [{ pusher: "omar", shas: ["d", "z"] }])), [[null, "abcd"]]);
  assert.deepEqual(shape(splitByPusher(GAP, [{ pusher: "omar", shas: ["a", "b"] }, { pusher: "lina", shas: ["b", "c"] }])), [
    ["omar", "ab"],
    [null, "cd"],
  ]);
});

test("the events asked about are pushes to this branch whose head is in the gap", () => {
  const event = (overrides: Partial<PushEventEntry>): PushEventEntry => ({ actor: "lina", ref: "refs/heads/main", before: "x", head: "b", ...overrides });
  const events = [
    event({}),
    event({ ref: "refs/heads/feature" }),
    event({ head: "z" }),
    event({ before: "0".repeat(40) }),
    event({ actor: "" }),
  ];

  assert.deepEqual(eventsToRead({ events, branch: "main", gap: GAP }), [event({})]);
});

test("a named part is a push by its pusher; an unnamed one is left as it was", () => {
  const push = recoveredPush({ fullName: "team/repo", defaultBranch: "main" }, "main", GAP);
  assert.ok(push);

  assert.equal(pushedBy(push, null), push);
  assert.equal(pushedBy(push, "lina").pushedBy, "lina");
  assert.equal(pushedBy(push, "lina").actorLogin, "lina");
});
