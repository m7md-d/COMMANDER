import { AR } from "./ar.js";
import { EN } from "./en.js";
import type { Dictionary, LocaleId } from "./types.js";
import { createTranslate } from "./types.js";

export const DICTIONARIES: Record<LocaleId, Dictionary> = {
  ar: AR,
  en: EN,
};

/** Bound translator. Every renderer in either app goes through this. */
export const t = createTranslate(DICTIONARIES);

export { AR, EN };
export * from "./types.js";
