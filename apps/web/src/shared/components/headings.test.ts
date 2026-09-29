import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");

test("a section under a page's title is its second level, not its third (W-13)", () => {
  // Every page is an h1 (PageHeader) over cards and articles. Titled h3, they
  // skipped a level on the operations room, the orders, the post, the setup
  // page and all five manual sections: a screen reader's outline had a hole
  // where the sections should hang.
  assert.match(read("./Card.tsx"), /<h2 className="card-title">/);
  assert.match(read("../../features/manual/components/Article.tsx"), /<h2 className="article-title">/);
});

test("a front's file names its front as the page's title (W-13)", () => {
  // The front page has no PageHeader: the letterhead is its head. Its subject
  // was a <strong>, and the page had no h1 at all.
  assert.match(read("../../features/repositories/components/FrontLetterhead.tsx"), /<h1 className="file-subject/);
});

test("the login screen is a main region, outside the layout that gives every other page one (W-13)", () => {
  const login = read("../../pages/LoginPage.tsx");
  assert.match(login, /<main className="auth-screen">/);
});
