import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

/** Every source file of the prompts page and its feature, as one text. */
function previewSources(): string {
  const page = readFileSync(new URL("../../pages/PromptsPage.tsx", import.meta.url), "utf8");
  const dir = new URL("./components/", import.meta.url);
  const parts = readdirSync(dir).map((name) => readFileSync(new URL(name, dir), "utf8"));
  return [page, ...parts].join("\n");
}

test("the preview shows why the model did not write, as the server said it (W-07)", () => {
  // With no OpenRouter key the server answered `llmError: "missing_api_key"`,
  // and the page showed only "the model call failed, a fallback was sent".
  assert.match(previewSources(), /\.llmError\b/);
});
