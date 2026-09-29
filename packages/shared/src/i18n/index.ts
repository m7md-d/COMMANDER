import { AR } from "./ar.js";
import { EN } from "./en.js";
import type { Dictionary, LocaleId, Translate } from "./types.js";
import { translateFrom } from "./types.js";

export const DICTIONARIES: Record<LocaleId, Dictionary> = {
  ar: AR,
  en: EN,
};

/**
 * Binds the dictionaries once and returns the translator everything else calls.
 *
 * The tables are a dependency, not an argument: they are the same on every one
 * of the thousands of calls a render makes, and passing them each time put this
 * function at four parameters (CONSTITUTION.md §4) for a value that never
 * varies. Closing over them leaves the call site with what actually changes.
 *
 * Resolution order: requested locale, then Arabic, then the key itself.
 *
 * The API's translator. The panel does not import it: it would carry both
 * dictionaries into every browser. It loads the one locale it shows and calls
 * `translateFrom` (apps/web/src/shared/i18n/I18nProvider.tsx).
 */
export function createTranslate(dictionaries: Record<LocaleId, Dictionary>): Translate {
  return (locale, key, vars) => {
    const table: Record<string, string> = dictionaries[locale] ?? dictionaries.ar;
    const fallback: Record<string, string> = AR;
    return translateFrom(key in table ? table : fallback, key, vars);
  };
}

/** Bound translator. Every renderer in the API goes through this. */
export const t = createTranslate(DICTIONARIES);

export { AR, EN };
export * from "./types.js";
