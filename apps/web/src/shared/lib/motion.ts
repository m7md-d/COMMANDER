/**
 * The motion vocabulary. Pure data — no React, no DOM.
 *
 * These mirror `--duration-*` and `--ease-*` in tokens.css, converted to the
 * seconds/array form framer-motion expects. They are restated here rather than
 * read from the DOM because reading a custom property means a layout query on
 * every animation, and the pairing is stable enough to keep in one place. If
 * you change a duration, change it in both — that is the whole contract.
 *
 * Direction note: every transition below moves on Y, scale or opacity, never X.
 * The panel flips between RTL and LTR, and an X offset that reads as "enters
 * from the leading edge" in Arabic reads as "enters from the trailing edge" in
 * English. Y is the same in both.
 */

export const DURATION = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
} as const;

/** Decelerating: enters quickly and settles. The default for anything arriving. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
/** Symmetric: for changes that are neither an arrival nor a departure. */
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

/** A scrim: nothing but opacity, so it never appears to move. */
export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASE_IN_OUT } },
} as const;

/** A floating panel: rises and settles into place. */
export const riseVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.99,
    transition: { duration: DURATION.fast, ease: EASE_IN_OUT },
  },
} as const;

/** A toast: drops in from the block edge it is anchored to. */
export const toastVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: DURATION.fast } },
} as const;

/** A route: content settles in without moving the furniture around it. */
export const pageVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
} as const;

/**
 * Staggered list entry. Applied to the container; children use `riseVariants`.
 * Capped deliberately — a stagger long enough to notice on a 40-row table
 * stops being feedback and becomes a wait.
 */
export const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
} as const;
