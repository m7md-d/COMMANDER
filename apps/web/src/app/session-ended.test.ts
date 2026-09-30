import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sessionEnded } from "./session-ended";

test("a 401 while signed in means the session ended — and nothing else does (W-22)", () => {
  assert.equal(sessionEnded({ status: 401, signedIn: true }), true);
  // A visitor on the public headquarters gets 401s by design: nothing ended.
  assert.equal(sessionEnded({ status: 401, signedIn: false }), false);
  assert.equal(sessionEnded({ status: 403, signedIn: true }), false);
  assert.equal(sessionEnded({ status: undefined, signedIn: true }), false);
});

test("every query and mutation that ends a session sends the panel back to the session check", () => {
  // Pages offered "retry" beside "the session ended": a 401 every time, and no
  // way back to the login page but typing its address.
  const client = readFileSync(new URL("./query-client.ts", import.meta.url), "utf8");

  assert.match(client, /queryCache: new QueryCache\(\{ onError: recheckSession \}\)/);
  assert.match(client, /mutationCache: new MutationCache\(\{ onError: recheckSession \}\)/);
});
