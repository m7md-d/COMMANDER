/**
 * CONSTITUTION.md §3 lives here.
 *
 * `ar` is the reference dictionary: its key set defines TranslationKey, so
 * `en` is type-checked against it. A key added to one and forgotten in the
 * other fails the build rather than silently rendering the raw key at runtime.
 */

// Type-only: the key set is the Arabic table's, and nothing that imports this
// file — the panel's translator above all — may carry the table itself with it.
import type { AR } from "./ar.js";

export type TranslationKey = keyof typeof AR;
export type Dictionary = Record<TranslationKey, string>;

export type TranslationVars = Record<string, string | number>;

export const LOCALES = [
  { id: "ar", name: "العربية", dir: "rtl" },
  { id: "en", name: "English", dir: "ltr" },
] as const;

export type LocaleId = (typeof LOCALES)[number]["id"];
export type Direction = (typeof LOCALES)[number]["dir"];

export function directionOf(locale: LocaleId): Direction {
  return locale === "ar" ? "rtl" : "ltr";
}

export type Translate = (locale: LocaleId, key: string, vars?: TranslationVars) => string;

/**
 * One dictionary's text for a key, its `{name}` variables filled. An unknown
 * placeholder is left visible rather than blanked, and a key the table does not
 * hold reads as the key itself — readable and greppable, never "undefined".
 *
 * Takes the one table in use, so the panel can load a single locale and
 * translate from it without the other in memory (ROADMAP 4.1).
 */
export function translateFrom(table: Readonly<Record<string, string>>, key: string, vars?: TranslationVars): string {
  const template = table[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}
