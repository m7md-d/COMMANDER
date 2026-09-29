/**
 * Language context. Owns the html lang/dir attributes so no component ever
 * reasons about direction (CONSTITUTION §3), and the one dictionary in use.
 *
 * The panel shows one language at a time, so it loads one dictionary, on its
 * own chunk, when it needs it (ROADMAP 4.1). Importing `t` from the shared
 * package instead carries both into every browser — the bundle guard in
 * tests/budgets/bundle.test.ts fails if a dictionary rides in `index` again.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  directionOf,
  translateFrom,
  type Dictionary,
  type LocaleId,
  type TranslationVars,
} from "@commander/shared";

const STORAGE_KEY = "commander.locale";

/** Each locale's dictionary, fetched on first use; Vite gives each its own chunk. */
const LOADERS: Record<LocaleId, () => Promise<Dictionary>> = {
  ar: () => import("@commander/shared/i18n/ar").then((module) => module.AR),
  en: () => import("@commander/shared/i18n/en").then((module) => module.EN),
};

interface I18nContextValue {
  locale: LocaleId;
  setLocale: (locale: LocaleId) => void;
  t: (key: string, vars?: TranslationVars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): LocaleId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "ar";
  } catch {
    // Private browsing can throw on localStorage access; the default is fine.
    return "ar";
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleId>(readStoredLocale);
  // The table on screen. Switching keeps the old one until the new one has
  // arrived, so the page never flashes raw keys.
  const [table, setTable] = useState<{ locale: LocaleId; dictionary: Dictionary } | null>(null);

  useEffect(() => {
    let current = true;
    void LOADERS[locale]().then((dictionary) => {
      if (!current) return;
      setTable({ locale, dictionary });
      document.documentElement.lang = locale;
      document.documentElement.dir = directionOf(locale);
    });
    return () => {
      current = false;
    };
  }, [locale]);

  const setLocale = useCallback((next: LocaleId) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persisting is a convenience; failing to do so must not break the app.
    }
  }, []);

  const value = useMemo<I18nContextValue | null>(
    () =>
      table && {
        locale: table.locale,
        setLocale,
        t: (key, vars) => translateFrom(table.dictionary, key, vars),
      },
    [table, setLocale],
  );

  // The first dictionary is one small request away; rendering before it would
  // show every label as its key.
  if (!value) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

/** Shorthand for the common case of needing only the translator. */
export function useTranslate(): (key: string, vars?: TranslationVars) => string {
  return useI18n().t;
}
