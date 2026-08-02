/**
 * The limits a front is judged by before anybody configures anything.
 *
 * Kept apart from the judgement because they are a different kind of decision: a
 * threshold is a calibration that should be argued with and changed, while
 * `judgeCheck` is a rule that should not. Mixing them invites tuning a number by
 * editing the logic around it.
 *
 * Every default here is set to be *quiet*. A check that fires on the middle of a
 * codebase's distribution is not a limit, it is a complaint about the language —
 * and the first thing anyone does with it is switch the whole subsystem off.
 */

import type { CheckConfigMap } from "./checks.js";

/** Files a person writes, in the languages this platform is likely to meet. */
const SOURCE: string[] = [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx",
      "**/*.mjs",
      "**/*.cjs",
      "**/*.py",
      "**/*.rb",
      "**/*.go",
      "**/*.rs",
      "**/*.java",
      "**/*.kt",
      "**/*.swift",
      "**/*.c",
      "**/*.h",
      "**/*.cpp",
      "**/*.hpp",
      "**/*.cs",
      "**/*.php",
      "**/*.sh",
      "**/*.sql",
      "**/*.css",
      "**/*.scss",
  "**/*.vue",
  "**/*.svelte",
];

/** What TypeScript's own parser reads. Exact structure, JSX understood. */
const PARSED: string[] = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"];

/** Parsed files minus the ones whose length is mostly markup — see below. */
const PARSED_LOGIC: string[] = PARSED.filter(
  (pattern) => pattern !== "**/*.tsx" && pattern !== "**/*.jsx",
);

/**
 * Where a brace actually delimits a block.
 *
 * Two exclusions, both because the scanner would otherwise measure something
 * that is not nesting:
 *
 * - **Indentation languages** (Python, Ruby, shell, SQL) measure depth 0
 *   honestly, which reads as a perfect score. Silence is better than flattery.
 * - **JSX and its cousins** put every expression in braces — `className={…}`,
 *   `onClick={() => …}` — and a scanner cannot tell those from blocks. Measured
 *   over this repository, `.tsx` files sat two to three levels above `.ts` files
 *   of the same complexity purely from interpolation. A metric with a built-in
 *   bias against one file type is the kind of noise that gets a check switched
 *   off, and then the honest metrics go off with it.
 * - **Stylesheets** nest braces by selector, which is not control flow either.
 */
const UNBRACED_BLOCKS = [
  // The parser reads these exactly, so `brace_depth` would be a second, worse
  // answer to a question already answered — and two metrics disagreeing about
  // one file is how a whole subsystem stops being believed.
  ...PARSED,
  "**/*.py",
  "**/*.rb",
  "**/*.sh",
  "**/*.sql",
  "**/*.css",
  "**/*.scss",
  "**/*.tsx",
  "**/*.jsx",
  "**/*.vue",
  "**/*.svelte",
];

const BRACED: string[] = SOURCE.filter((pattern) => !UNBRACED_BLOCKS.includes(pattern));

/** Generated, vendored, or otherwise nobody's handiwork. */
const NOT_OURS: string[] = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/vendor/**",
  "**/.next/**",
  "**/*.min.js",
  "**/*.min.css",
  "**/*.generated.*",
  "**/*.d.ts",
  "**/migrations/**",
];

export const DEFAULT_CHECKS: CheckConfigMap = {
  file_lines: { enabled: true, threshold: 200, include: SOURCE, exclude: NOT_OURS },
  /**
   * The longest function, measured by the parser from its first line to its last.
   *
   * JSX files are out of scope on purpose. A component's length is mostly
   * markup, and a metric that cannot tell a hundred lines of `return (…)` from a
   * hundred lines of logic is measuring the wrong thing — measured here, `>40`
   * flagged 62 of 308 files with JSX included and 16 of 198 without.
   *
   * Fifty rather than the forty a linter would use, because this counts the
   * signature and closing line too: on this repository, which enforces forty by
   * lint, fifty flags exactly one function.
   */
  function_lines: { enabled: true, threshold: 50, include: PARSED_LOGIC, exclude: NOT_OURS },

  /**
   * Real block nesting, from the AST: control flow, function bodies and class
   * bodies. An object literal, a type literal and a JSX expression are braces
   * and none of them is nesting — which is exactly what a brace counter cannot
   * know, and why JSX files are in scope here and not for `brace_depth`.
   *
   * Not directly comparable to the constitution's "3 levels": that counts from
   * inside a function, while this counts from the file, so a class method is
   * already at two. Measured across 308 files the depths run 0–5 (147 at 1, 71
   * at 2, 33 at 3, 10 at 4, 1 at 5); four flags the single genuine outlier.
   */
  nesting_depth: { enabled: true, threshold: 4, include: PARSED, exclude: NOT_OURS },

  /**
   * The fallback for brace languages the parser does not read — Java, Go, Rust,
   * C and their relations. A heuristic, and scoped to where nothing better is
   * available rather than used where something better is.
   */
  brace_depth: { enabled: true, threshold: 6, include: BRACED, exclude: NOT_OURS },
  /** Off by default. It is the most arguable of the three — plenty of good code
   *  carries a long import line — so it is offered rather than imposed. */
  line_length: { enabled: false, threshold: 120, include: SOURCE, exclude: NOT_OURS },
};
