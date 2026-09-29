import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the front picker sits on the board it filters, not over the whole-platform figures (W-09)", () => {
  // In the page header, the picker read as the scope of everything under it —
  // but the six tiles count every front and did not move when it changed. The
  // leaderboard is the only thing it filters.
  const page = readFileSync(new URL("./OverviewPage.tsx", import.meta.url), "utf8");
  const header = page.slice(page.indexOf("<PageHeader"), page.indexOf("/>", page.indexOf("<PageHeader")));
  const board = page.slice(page.indexOf('title={t("overview.leaderboard")}'));

  assert.doesNotMatch(header, /RepositoryPicker/);
  assert.match(board.slice(0, board.indexOf("<Leaderboard")), /<RepositoryPicker/);
});
