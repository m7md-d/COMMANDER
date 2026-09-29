import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arrive } from "./arrive";

function recorder() {
  const calls: string[] = [];
  return {
    calls,
    content: { focus: (options?: FocusOptions) => calls.push(`focus ${JSON.stringify(options ?? {})}`) },
    view: { scrollTo: (options: ScrollToOptions) => calls.push(`scrollTo ${JSON.stringify(options)}`) },
  };
}

test("a new page opens at its top, focus moves without scrolling the content under the header (W-01)", () => {
  // Focusing the content region let the browser scroll it to the top of the
  // window, under the sticky header: every long page opened 116px down, its
  // title hidden. And without a scroll of its own, a page opened wherever the
  // last one had been scrolled to.
  const { calls, content, view } = recorder();

  arrive({ content, view });

  assert.deepEqual(calls, ['scrollTo {"top":0}', 'focus {"preventScroll":true}']);
});

test("the route hook arrives through arrive(), so the scroll cannot come back", () => {
  const hook = readFileSync(new URL("../hooks/useRouteFocus.ts", import.meta.url), "utf8");

  assert.match(hook, /arrive\(\{/);
  assert.doesNotMatch(hook, /\.focus\(\)/);
});
