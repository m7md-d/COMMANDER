/**
 * No source file is invisible to git.
 *
 * This exists because it happened. `.gitignore` carried a bare `coverage/`,
 * meant for a coverage tool's output; git matches that name at any depth, so it
 * also matched `tests/coverage/` — eight of this project's guards, including the
 * one that checks every cited path and the one that checks every domain function
 * has a test.
 *
 * Nothing failed. The guards run off the filesystem, so they kept passing here;
 * a fresh clone would simply have had fewer of them than the README claims, and
 * `npm run test:guards` would have reported a smaller number that nobody was
 * comparing against anything. It was caught by inspection before the first push,
 * which is not a control.
 *
 * The check runs `git check-ignore` rather than reading `.gitignore`: the rules
 * compose across the repo file, nested files, `.git/info/exclude` and the user's
 * global ignore, and reimplementing that is how you get a guard that disagrees
 * with the tool it is guarding.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { allSources, report, ROOT, type Finding } from "../lib/sources.js";

/** Build output and dependencies are ignored on purpose and never walked anyway. */
const paths = (): string[] => allSources().map((file) => file.path);

function ignoredAmong(candidates: string[]): string[] {
  // --stdin in one call: one git process for the whole repo, and check-ignore
  // exits 1 when nothing matches, which is the success case here.
  const out = execFileSync("git", ["check-ignore", "--stdin"], {
    cwd: ROOT,
    input: candidates.join("\n"),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return out.split("\n").filter(Boolean);
}

test("every source file is visible to git", (t) => {
  let ignored: string[];
  try {
    ignored = ignoredAmong(paths());
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 1) ignored = []; // nothing matched
    else {
      t.skip("no git repository here — cannot ask what would be committed");
      return;
    }
  }

  const findings: Finding[] = ignored.map((path) => ({
    path,
    line: 1,
    detail: "ignored by git — it would not exist in a fresh clone",
  }));

  assert.equal(
    findings.length,
    0,
    `${report(findings, ".gitignore — no source file is invisible to git")}\n\nAnchor the rule that catches it (\`/coverage/\` rather than \`coverage/\`) or narrow its path. A file that runs locally and is absent from the clone fails for the next person, not for you.`,
  );
});
