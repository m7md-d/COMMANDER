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
   * Raised 110 → 114 on 2026-07-28, measured 110.3 after the assessment section.
   *
   * The growth is honest — a feature's text — but it exposed something worth
   * fixing rather than absorbing: **both dictionaries ship in full to every
   * browser, including keys only the server ever reads.** `digest.prompt`,
   * `assess.instruction` and their kind are instructions to a model, rendered on
   * the API and never by the panel, and the panel only ever displays one locale
   * at a time. Splitting the dictionaries per locale and lazy-loading the one in
   * use would return more than every feature since has cost. Recorded in
   * docs/UI-AUDIT.md; until it is done this number will keep drifting upward,
   * and that drift is the argument, not the problem.
   */
  index: 114,
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
