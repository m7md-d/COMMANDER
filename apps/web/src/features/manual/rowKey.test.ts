import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { rowKey } from "./rowKey";

test("rows whose subject is an element get distinct keys (W-14)", () => {
  // The orders table's first cell is a <code>. `String(element)` is
  // "[object Object]" for every row, and React warned of duplicate keys.
  const rows = ["repo", "branch"].map((name) => [createElement("code", { key: name }, name), "carries"]);

  assert.deepEqual(rows.map(rowKey), ["repo", "branch"]);
});

test("an element with no key falls back to its position, and text keys by itself", () => {
  const rows = [[createElement("code", null, "a")], [createElement("code", null, "b")], ["plain"]];

  assert.deepEqual(rows.map(rowKey), ["0", "1", "plain"]);
});
