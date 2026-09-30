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

test("the picker and the reset button wrap on a narrow screen (W-20)", () => {
  // In a nowrap row, the English "Reset stats" beside a front's name pushed the
  // page 24px wider than a 390px phone, and the whole page scrolled sideways.
  const page = readFileSync(new URL("./OverviewPage.tsx", import.meta.url), "utf8");
  const actions = page.slice(page.indexOf("actions={"), page.indexOf("<RepositoryPicker"));

  assert.match(actions, /className="row row-wrap"/);
});
