/**
 * What counts as a source file, decided once.
 *
 * Every guard asks the same question — "which files must obey this rule?" — and
 * if each answered it for itself the guards would slowly disagree about the
 * repository they are guarding. So the walk, the skip list and the layer
 * classification live here, and a test states only its rule.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Build output and dependencies — nothing under these was written to be governed. */
const SKIP_NAMES = new Set(["node_modules", "dist", "build", ".git", ".vite", "generated"]);

/**
 * Coverage *output*, by path rather than by name.
 *
 * `coverage` was in the set above, and a bare name matches at any depth: it also
 * matched `tests/coverage/`, so eight guards were never subject to any of the
 * rules the guards enforce — not the size limit, not naming, not the reference
 * check. Silently, because a directory that is never walked reports nothing.
 * `.gitignore` had the identical bug for the identical reason; both are anchored
 * now.
 */
const SKIP_PATHS = new Set([
  "coverage",
  "apps/api/coverage",
  "apps/web/coverage",
  "packages/shared/coverage",
]);

const CODE = new Set([".ts", ".tsx"]);
const STYLE = new Set([".css"]);
const PROSE = new Set([".md"]);

export interface SourceFile {
  /** Repo-relative, always with forward slashes so patterns are portable. */
  path: string;
  text: string;
  ext: string;
}

const repoPath = (full: string): string => relative(ROOT, full).split(sep).join("/");

function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    if (SKIP_PATHS.has(repoPath(full))) continue;
    if (statSync(full).isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

let cache: SourceFile[] | null = null;

/** Every governed file in the repository, read once per test process. */
export function allSources(): SourceFile[] {
  if (cache) return cache;

  cache = walk(ROOT)
    .map((full) => ({ full, ext: extname(full) }))
    .filter(({ ext }) => CODE.has(ext) || STYLE.has(ext))
    .map(({ full, ext }) => ({
      path: repoPath(full),
      text: readFileSync(full, "utf8"),
      ext,
    }));

  return cache;
}

/**
 * Markdown, kept out of `allSources` on purpose: the guards that read source ask
 * about `any`, swallowed catches and hard-coded strings, and prose would answer
 * yes to all three. Only the reference guard has a question for it.
 */
export function markdown(): SourceFile[] {
  return walk(ROOT)
    .map((full) => ({ full, ext: extname(full) }))
    .filter(({ ext }) => PROSE.has(ext))
    .map(({ full, ext }) => ({
      path: repoPath(full),
      text: readFileSync(full, "utf8"),
      ext,
    }));
}

export const isTest = (file: SourceFile): boolean => file.path.includes(".test.");
export const isStyle = (file: SourceFile): boolean => STYLE.has(file.ext);
export const isComponent = (file: SourceFile): boolean => file.ext === ".tsx";

/** Source files only — the guards' own code is not the subject of the guards. */
export function sources(): SourceFile[] {
  return allSources().filter((file) => !file.path.startsWith("tests/"));
}

export function under(prefix: string): SourceFile[] {
  return sources().filter((file) => file.path.startsWith(prefix));
}

export function lineCount(text: string): number {
  return text.split("\n").length;
}

/**
 * The 1-based line a match falls on, so a failure names a place rather than an
 * offset. Cheap enough at this repo size to recompute per finding.
 */
export function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

interface Span {
  start: number;
  end: number;
}

/** Past a string literal, so nothing inside one is ever read as syntax. */
function endOfString(text: string, open: number, quote: string): number {
  for (let i = open + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\\") i += 1;
    else if (ch === quote) return i + 1;
    // An unterminated quote is a typo, not a string that swallows the file.
    else if (ch === "\n" && quote !== "`") return i;
  }
  return text.length;
}

/**
 * Where the comments are, found by scanning and not by regex.
 *
 * `"src/*.ts"` opens no comment. A pattern that thinks it does runs on to the
 * next close marker — which in a file of glob fixtures is most of the file, and
 * the lines it swallows are then read as prose. That was a real false positive,
 * not a hypothetical one.
 *
 * Regex literals are the acknowledged gap: `/…\/\//` can still look like a line
 * comment. It costs a little extra prose, never a missed comment, so no rule
 * built on this can fire on work that is actually correct.
 */
function scan(text: string): { comments: Span[]; strings: Span[] } {
  const comments: Span[] = [];
  const strings: Span[] = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' || ch === "'" || ch === "`") {
      const end = endOfString(text, i, ch);
      strings.push({ start: i, end });
      i = end;
    } else if (ch === "/" && next === "*") {
      const close = text.indexOf("*/", i + 2);
      const end = close === -1 ? text.length : close + 2;
      comments.push({ start: i, end });
      i = end;
    } else if (ch === "/" && next === "/" && text[i - 1] !== ":") {
      const newline = text.indexOf("\n", i);
      const end = newline === -1 ? text.length : newline;
      comments.push({ start: i, end });
      i = end;
    } else {
      i += 1;
    }
  }

  return { comments, strings };
}

/** Same length, same line numbers — only the kept region differs. */
function mask(text: string, spans: Span[], keep: "inside" | "outside"): string {
  const chars = (keep === "inside" ? text.replace(/[^\n]/g, " ") : text).split("");

  for (const { start, end } of spans) {
    for (let i = start; i < end; i += 1) {
      chars[i] = keep === "inside" ? text[i]! : text[i] === "\n" ? "\n" : " ";
    }
  }

  return chars.join("");
}

/**
 * Source with comments blanked, for rules that must not fire on prose. Replaces
 * rather than deletes, so every reported line number still points at the real line.
 */
export function codeOnly(text: string): string {
  return mask(text, scan(text).comments, "outside");
}

/**
 * The counterpart: prose kept, code blanked. For rules that must read only what
 * a human wrote to another human — a path in a comment is a citation, the same
 * path in an array is data.
 */
export function commentsOnly(text: string): string {
  return mask(text, scan(text).comments, "inside");
}

/**
 * Identifiers and syntax alone — comments *and* string bodies blanked. For rules
 * that ask whether the code refers to a thing, where prose must not answer for
 * it: a test titled `"coming back under the limit is a credit"` says nothing
 * about whether `credit()` was ever called, and counting the word as a reference
 * marks an untested function tested.
 */
export function symbolsOnly(text: string): string {
  const { comments, strings } = scan(text);
  return mask(text, [...comments, ...strings], "outside");
}

export interface Finding {
  path: string;
  line: number;
  detail: string;
}

/** A failure that names every offender, because one path per run is a slow fix. */
export function report(findings: Finding[], rule: string): string {
  return [
    `${findings.length} violation(s) of ${rule}:`,
    ...findings.map((f) => `  ${f.path}:${f.line}  ${f.detail}`),
  ].join("\n");
}
