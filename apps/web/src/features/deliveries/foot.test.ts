import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("a dispatch's two actions wrap together, never the archive button alone (W-16)", () => {
  // The footer wrapped item by item: in the compact view, and on an English
  // card, "Archive" fell to a line of its own under "Rewrite and send".
  const card = readFileSync(new URL("./components/DeliveryCard.tsx", import.meta.url), "utf8");
  const actions = card.slice(card.indexOf('<span className="dispatch-actions">'));

  assert.ok(card.includes('<span className="dispatch-actions">'), "the actions are grouped");
  assert.match(actions.slice(0, actions.indexOf("</span>")), /onResend[\s\S]*onArchive/);
});
