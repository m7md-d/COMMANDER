/**
 * The deceptive cases are the point (apps/api/CONSTITUTION.md §7): an untouched
 * file must appear in none of the lists, and a file that merely *moved* must not
 * be reported as edited.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { diffTree, type StoredFile } from "./diff.js";

const STORED: StoredFile[] = [
  { path: "src/app.ts", blobSha: "a1" },
  { path: "src/core/log.ts", blobSha: "b1" },
];

function listing(pairs: [path: string, sha: string][]) {
  return pairs.map(([path, sha]) => ({ path, sha }));
}

const UNCHANGED = listing([
  ["src/app.ts", "a1"],
  ["src/core/log.ts", "b1"],
]);

test("a new path is added", () => {
  const changes = diffTree(STORED, [...UNCHANGED, { path: "src/new.ts", sha: "c1" }]);

  assert.deepEqual(
    changes.added.map((entry) => entry.path),
    ["src/new.ts"],
  );
  assert.equal(changes.changed.length, 0);
  assert.equal(changes.removed.length, 0);
});

test("a path whose blob moved is changed, not re-added", () => {
  const changes = diffTree(
    STORED,
    listing([
      ["src/app.ts", "a2"],
      ["src/core/log.ts", "b1"],
    ]),
  );

  assert.deepEqual(
    changes.changed.map((entry) => entry.path),
    ["src/app.ts"],
  );
  assert.equal(changes.added.length, 0);
});

test("a path gone from the listing is removed", () => {
  const changes = diffTree(STORED, listing([["src/app.ts", "a1"]]));

  assert.deepEqual(changes.removed, ["src/core/log.ts"]);
  assert.equal(changes.changed.length, 0);
});

test("an untouched tree produces no work at all", () => {
  assert.deepEqual(diffTree(STORED, UNCHANGED), {
    added: [],
    changed: [],
    removed: [],
    touched: [],
  });
});

/**
 * A rename carries the same content to a new path: the old path is gone and the
 * new one is new, but nothing was *edited*. Calling it a change would credit an
 * author with lines they never wrote — and the blob's measurement is already on
 * record under its sha either way, so the rename costs nothing to re-measure.
 */
test("a rename is a removal and an addition, never a change", () => {
  const changes = diffTree(
    STORED,
    listing([
      ["src/main.ts", "a1"],
      ["src/core/log.ts", "b1"],
    ]),
  );

  assert.deepEqual(
    changes.added.map((entry) => entry.path),
    ["src/main.ts"],
  );
  assert.deepEqual(changes.removed, ["src/app.ts"]);
  assert.equal(changes.changed.length, 0);
});

/** Entries keep whatever else they carry, so the writer still has byte lengths. */
test("the diff preserves the caller's own entry shape", () => {
  const changes = diffTree(STORED, [{ path: "src/new.ts", sha: "c1", bytes: 42 }]);

  assert.equal(changes.added[0]?.bytes, 42);
});

/**
 * `touched` exists because the old sha is gone from the table the moment the
 * sync writes. Without carrying it here, a check could never tell "pushed this
 * file over the limit" from "found it already over".
 */
test("touched carries what was at each path before, and nothing that was untouched", () => {
  const changes = diffTree(
    STORED,
    listing([
      ["src/app.ts", "a2"],
      ["src/core/log.ts", "b1"],
      ["src/new.ts", "c1"],
    ]),
  );

  assert.deepEqual(changes.touched, [
    { path: "src/new.ts", sha: "c1", previousSha: null },
    { path: "src/app.ts", sha: "a2", previousSha: "a1" },
  ]);
});
