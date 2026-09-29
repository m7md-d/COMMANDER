import assert from "node:assert/strict";
import { test } from "node:test";
import { resendKind } from "./delivery.js";

test("resendKind: what never reached Discord is written as the first report", () => {
  assert.equal(resendKind({ status: "failed", judged: true }), "first");
  // Withheld — silent when clean, or no channel then: someone pressed and is waiting.
  assert.equal(resendKind({ status: "skipped", judged: true }), "first");
});

test("resendKind: what was sent is rewritten, and knows it is a rewrite (0012)", () => {
  assert.equal(resendKind({ status: "sent", judged: true }), "rewrite");
});

test("resendKind: nothing to resend while in flight, or with no judgement kept", () => {
  assert.equal(resendKind({ status: "pending", judged: true }), null);
  assert.equal(resendKind({ status: "processing", judged: true }), null);
  // A row from before 0012 keeps no judgement: sending it again would mean judging it again (D-31).
  assert.equal(resendKind({ status: "sent", judged: false }), null);
  assert.equal(resendKind({ status: "failed", judged: false }), null);
});
