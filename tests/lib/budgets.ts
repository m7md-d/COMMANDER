/**
 * Every number the guards enforce, in one table.
 *
 * Scattered thresholds get raised one at a time by whoever is inconvenienced by
 * them, and nobody ever sees the trend. Here a change to any limit is a diff on
 * this file — visible, reviewable, and requiring the same justification the
 * constitution demands for changing a rule (CONSTITUTION.md §9).
 */

/** CONSTITUTION.md §4 and apps/web/CONSTITUTION.md §5. */
export const SIZE = {
  file: 200,
  component: 150,
  /** i18n dictionaries are flat data tables; splitting them helps no one. */
  exempt: [/^packages\/shared\/src\/i18n\//],
} as const;

/**
 * Shipped weight, gzipped, per built chunk. Set from the measured size at the
 * time of writing plus room to work — a budget that already fails teaches
 * nothing, and one with no headroom fails on every honest addition.
 *
 * `index` is our own application code and is the one to watch: the vendor
 * chunks are fixed costs that only move when a dependency is added, which is
 * itself a constitutional decision (apps/web/CONSTITUTION.md §8).
 */
export const BUNDLE_GZIP_KB = {
  /**
   * Lowered 114 → 80 on 2026-09-29, measured 75.6 once the dictionaries left it.
   *
   * It had been raised 110 → 114 on 2026-07-28 for a feature's text, and was
   * over again at 114.4 with the report log (0012). The cause was recorded then:
   * both dictionaries shipped in full to every browser, though the panel shows
   * one language at a time. Each now loads on its own, when needed (ROADMAP 4.1,
   * UI-AUDIT #22), and bundle.test.ts fails if one rides in `index` again.
   */
  index: 80,
  /**
   * One dictionary each, loaded when the panel shows that language. Lowered
   * 24 → 21 and 21 → 18 on 2026-09-30, measured 18.5 and 16.0 once the keys only
   * the API reads (`digest.prompt`, `report.rewrite`…) moved to `*.server.ts` —
   * the other half of UI-AUDIT #22. bundle.test.ts fails if one comes back.
   */
  ar: 21,
  en: 18,
  vendor: 60,
  motion: 45,
  ui: 40,
  query: 20,
  css: 14,
  /** The whole page's first load. The number that decides whether it feels fast. */
  total: 280,
} as const;

/**
 * Response budgets in milliseconds, measured against a running stack. These are
 * generous on purpose: the guard exists to catch a route that has become
 * pathological, not to police normal variance on a laptop under docker.
 */
export const RESPONSE_MS = {
  /** A read the panel makes on nearly every screen. */
  list: 400,
  /** Session check — it gates the first paint, so it must be quick. */
  session: 250,
} as const;

/** Where the built web assets land, relative to the repository root. */
export const WEB_DIST = "apps/web/dist";

/**
 * The least contrast text may have against what it is drawn on — WCAG 2.1 AA
 * for body-size text. The situation screens' labels drew at 2.73 : 1 and could
 * barely be read (docs/UI-DEFECTS.md W-10).
 */
export const TEXT_CONTRAST_MIN = 4.5;
