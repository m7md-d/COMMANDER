import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateTime } from "./format";

test("a timestamp is isolated from the sentence it sits in (W-06)", () => {
  // Formatted in the browser's language, an Arabic date inside the English
  // panel was reordered by its neighbours: "2026/9/29، 8:50 ص" read
  // "2026/9/، 8:50 ص29". First-strong isolation lets it keep its own direction.
  const shown = formatDateTime("2026-09-29T05:50:00.000Z", "—");

  assert.ok(shown.startsWith("⁨"), "starts with FSI");
  assert.ok(shown.endsWith("⁩"), "ends with PDI");
});

test("a missing or unreadable timestamp shows the fallback as it is", () => {
  assert.equal(formatDateTime(null, "—"), "—");
  assert.equal(formatDateTime("not a date", "—"), "—");
});
