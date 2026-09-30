import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { answeredNothing } from "./client";

test("a reply with no body, 204, is a success that carries nothing (W-23)", () => {
  // Deleting a front deleted it, and the panel read the empty reply as a failed
  // envelope: an empty error toast, and no way off the deleted front's page.
  assert.equal(answeredNothing({ status: 204, data: "" }), true);
  assert.equal(answeredNothing({ status: 200, data: { ok: true, data: null } }), true);
  assert.equal(answeredNothing({ status: 200, data: { ok: false, error: "repos.notFound" } }), false);
  assert.equal(answeredNothing({ status: 200, data: "" }), false);
});

test("every request the server answers with 204 goes through api.remove", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : path.endsWith("api.ts") ? [path] : [];
    });
  const found = files(new URL("../../features", import.meta.url).pathname).filter((path) => /api\.delete<void>/.test(readFileSync(path, "utf8")));

  assert.deepEqual(found, [], "api.delete<void> reads a 204 as a failed envelope — use api.remove");
});
