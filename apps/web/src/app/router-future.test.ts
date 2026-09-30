import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the router runs with v7's behaviour now, so no page logs a future-flag warning", () => {
  // React Router 6 printed two warnings on every page (UI-DEFECTS observations):
  // v7_startTransition and v7_relativeSplatPath. The one splat route here
  // navigates to "/", an absolute path, so the second changes nothing.
  const providers = readFileSync(new URL("./providers.tsx", import.meta.url), "utf8");

  assert.match(providers, /<BrowserRouter future=\{\{ v7_startTransition: true, v7_relativeSplatPath: true \}\}>/);
});
