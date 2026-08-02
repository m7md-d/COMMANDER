/** Pure formatting helpers. No React, no network. */

import type { TranslationKey } from "@commander/shared";

/**
 * Uses the browser's locale rather than the panel's: timestamps are read
 * against the operator's own clock and regional conventions, not the language
 * the interface happens to be in.
 */
export function formatDateTime(value: string | null, fallback: string): string {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

const KB = 1024;
const MB = KB * KB;

/**
 * A byte count split into a number and the key that names its unit.
 *
 * The unit is text, and text lives in the dictionary (§3) — so this returns the
 * key rather than the word, and the caller translates. One decimal at megabyte
 * scale and none below it: "1.8 MB" is a useful figure, "1843 KB" is noise.
 */
export function formatBytes(bytes: number): { value: string; unit: TranslationKey } {
  if (bytes >= MB) return { value: (bytes / MB).toFixed(1), unit: "tree.sizeMb" };
  if (bytes >= KB) return { value: String(Math.round(bytes / KB)), unit: "tree.sizeKb" };
  return { value: String(bytes), unit: "tree.sizeBytes" };
}

export function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
