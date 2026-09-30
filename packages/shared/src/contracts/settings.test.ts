import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSettings, settingsSchema } from "./settings.js";

test("the code review is off until someone turns it on (0009 §7, D-39)", () => {
  // Each reviewed push costs a model request. It ran whenever the App and a
  // model key were there, on every commit, and nobody had chosen that price.
  const settings = defaultSettings("some/model");

  assert.equal(settings.review, false);
  assert.equal(settingsSchema.safeParse(settings).success, true);
});
