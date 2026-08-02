/**
 * Ordering is the whole contract here: a specific branch must be able to claim
 * its own gravity before a catch-all pattern absorbs it. These pin that, and pin
 * that an unconfigured repository behaves exactly as it did before watchers
 * existed.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveWatcher, type Watcher } from "./watcher.js";

function watcher(pattern: string, gravity: Watcher["gravity"]): Watcher {
  return { pattern, gravity, promptId: null, model: "" };
}

const LIST = [
  watcher("main", "critical"),
  watcher("release/*", "guarded"),
  watcher("*", "routine"),
];

test("the first matching pattern wins, so a specific branch outranks the catch-all", () => {
  assert.equal(resolveWatcher(LIST, "main").gravity, "critical");
  assert.equal(resolveWatcher(LIST, "release/2.0").gravity, "guarded");
  assert.equal(resolveWatcher(LIST, "feature/spike").gravity, "routine");
});

test("order decides: a catch-all placed first swallows everything after it", () => {
  const shadowed = [watcher("*", "routine"), watcher("main", "critical")];

  assert.equal(resolveWatcher(shadowed, "main").gravity, "routine");
});

test("an unconfigured repository stays routine, with no prompt or model override", () => {
  const resolved = resolveWatcher([], "main");

  assert.equal(resolved.gravity, "routine");
  assert.equal(resolved.promptId, null);
  assert.equal(resolved.model, "");
});

test("a branch matching nothing falls back rather than being left unwatched", () => {
  const partial = [watcher("main", "critical")];

  assert.equal(resolveWatcher(partial, "dev").gravity, "routine");
});
