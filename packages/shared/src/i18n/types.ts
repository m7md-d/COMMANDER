/**
 * CONSTITUTION.md §3 lives here.
 *
 * `ar` is the reference dictionary: its key set defines TranslationKey, so
 * `en` is type-checked against it. A key added to one and forgotten in the
 * other fails the build rather than silently rendering the raw key at runtime.
 */

import { AR } from "./ar.js";

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
 * Binds the dictionaries once and returns the translator everything else calls.
 *
 * The tables are a dependency, not an argument: they are the same on every one
 * of the thousands of calls a render makes, and passing them each time put this
 * function at four parameters (CONSTITUTION.md §4) for a value that never
 * varies. Closing over them leaves the call site with what actually changes.
 *
 * Resolution order: requested locale, then Arabic, then the key itself. A
 * missing translation degrades to something readable and greppable instead of
 * throwing or rendering "undefined".
 */
export function createTranslate(dictionaries: Record<LocaleId, Dictionary>): Translate {
  return (locale, key, vars) => {
    const table = dictionaries[locale] ?? dictionaries.ar;
    const template =
      (table as Record<string, string>)[key] ?? (AR as Record<string, string>)[key] ?? key;

    if (!vars) return template;

    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
    );
  };
}
