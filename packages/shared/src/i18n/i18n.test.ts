import assert from "node:assert/strict";
import { test } from "node:test";
import { translateFrom } from "./types.js";

const TABLE = { "hello.name": "أهلاً {name}", "plain": "ثابت" };

test("translateFrom: one dictionary, its variables filled, and an unknown placeholder left visible", () => {
  assert.equal(translateFrom(TABLE, "hello.name", { name: "سارة" }), "أهلاً سارة");
  assert.equal(translateFrom(TABLE, "hello.name", {}), "أهلاً {name}");
  assert.equal(translateFrom(TABLE, "plain"), "ثابت");
});

test("translateFrom: a key the table does not hold reads as the key — greppable, never undefined", () => {
  assert.equal(translateFrom(TABLE, "missing.key"), "missing.key");
});
