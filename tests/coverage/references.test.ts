/**
 * Every path this repository points at must exist.
 *
 * The guards cite documents by clause — a failure that reads
 * `docs/CHECKS-ROADMAP.md §3` means the reason is written there rather than left
 * to be guessed. Code comments do the same. That makes those paths part of the
 * contract, and a renamed or deleted document turns every citation of it into a
 * dead end that nothing else in the project would notice: the code compiles, the
 * tests pass, and the reader is sent nowhere.
 *
 * Anchors (`#section`) are deliberately not checked. Heading slugs differ between
 * renderers and most of ours are Arabic; a guard that disagrees with GitHub about
 * a slug would fire on correct links, and a guard that fires on correct work gets
 * switched off.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import {
  allSources,
  commentsOnly,
  lineOf,
  markdown,
  report,
  ROOT,
  type Finding,
} from "../lib/sources.js";

/** `[text](target)` — the only link form used in this repo's markdown. */
const MARKDOWN_LINK = /\]\(([^)\s]+)\)/g;

/**
 * A repo-relative path written in prose or a comment, e.g. `tests/lib/budgets.ts`
 * in a failure message. Anchored on the four top-level directories so ordinary
 * words followed by a dot cannot match, and required to end in an extension so
 * that directory mentions — which are usually illustrative — stay out.
 */
const BARE_PATH =
  /(?<![\w./-])((?:apps|packages|docs|tests|scripts)\/[\w./@-]+\.[a-z]{2,8})(?![\w/-])/g;

/**
 * `@path/to/file.md` on its own line — how CLAUDE.md loads `.claude/rules/`.
 * Worth its own pattern because the failure is invisible: an import that does not
 * resolve loads no rules and reports nothing, so the model works without them and
 * everything appears normal.
 */
const AT_IMPORT = /^[ \t]*@([\w./-]+\.md)[ \t]*$/gm;

/** Globs describe a set, not a file; `existsSync` has nothing to say about them. */
const isGlob = (target: string): boolean => /[*?[\]{}]/.test(target);

const isExternal = (target: string): boolean =>
  /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#") || target.startsWith("//");

/** Anchors and queries name a place inside a file, not another file. */
const withoutFragment = (target: string): string => target.split("#")[0]!.split("?")[0]!;

interface Scan {
  text: string;
  pattern: RegExp;
  /** The directory a relative target is resolved against. */
  from: string;
  onMissing: (target: string, index: number) => void;
}

function collect({ text, pattern, from, onMissing }: Scan): void {
  for (const match of text.matchAll(pattern)) {
    const raw = match[1];
    if (raw === undefined) continue;
    const target = withoutFragment(raw);
    if (target === "" || isExternal(raw) || isGlob(target)) continue;
    if (!existsSync(join(from, target))) onMissing(target, match.index);
  }
}

test("every document path the repo points at resolves", () => {
  const findings: Finding[] = [];

  for (const file of markdown()) {
    const note = (detail: (target: string) => string) => (target: string, index: number) =>
      findings.push({ path: file.path, line: lineOf(file.text, index), detail: detail(target) });

    collect({
      text: file.text,
      pattern: MARKDOWN_LINK,
      from: join(ROOT, dirname(file.path)),
      onMissing: note(
        (target) => `link to ${normalize(join(dirname(file.path), target))} — no such file`,
      ),
    });
    collect({
      text: file.text,
      pattern: BARE_PATH,
      from: ROOT,
      onMissing: note((target) => `mentions ${target} — no such file`),
    });
    collect({
      text: file.text,
      pattern: AT_IMPORT,
      from: join(ROOT, dirname(file.path)),
      onMissing: note((target) => `imports ${target} — no such file, so those rules never load`),
    });
  }

  // Bare paths only: an import that does not resolve is already a compile error,
  // so citations are the part no other check covers.
  //
  // In `apps/` and `packages/` only comments are read, because a path in code is
  // usually data about somebody else's repository — the candidate rules files
  // `enrichment.service.ts` looks for, the scope fixtures in `checks.test.ts`.
  // Those describe files that are *supposed* not to exist here. The guards under
  // `tests/` carry their citations in failure messages rather than comments and
  // hold no such fixtures, so they are read whole.
  for (const file of allSources()) {
    collect({
      text: file.path.startsWith("tests/") ? file.text : commentsOnly(file.text),
      pattern: BARE_PATH,
      from: ROOT,
      onMissing: (target, index) =>
        findings.push({
          path: file.path,
          line: lineOf(file.text, index),
          detail: `cites ${target} — no such file`,
        }),
    });
  }

  assert.equal(
    findings.length,
    0,
    `${report(findings, "docs/README.md — every cited path must resolve")}\n\nFix the path, or if the document moved, move the citation with it. A guard citing a clause that no longer exists is worse than a guard with no citation.`,
  );
});
