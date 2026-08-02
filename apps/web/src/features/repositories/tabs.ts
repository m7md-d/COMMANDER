/**
 * The sections of a front's file, in the order their tabs are cut.
 *
 * Named here rather than inline in the component because two things need the
 * list and must not disagree: the file that renders the tabs, and the skeleton
 * that reserves the strip's height before the data arrives. A hand-counted
 * placeholder is a placeholder that goes stale on the next tab added.
 */
export const FRONT_TABS = ["identity", "project", "branches", "rules", "roster", "tree"] as const;

export type FrontTab = (typeof FRONT_TABS)[number];

export const FIRST_TAB: FrontTab = FRONT_TABS[0];
