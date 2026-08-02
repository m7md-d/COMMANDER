/**
 * The model catalogue the panel's picker shows. Populated from OpenRouter's
 * public /models list, narrowed to the free tier and enriched with a provider
 * slug the panel maps to an insignia.
 *
 * This is a response contract only — the list is server-produced, so there is no
 * request schema to validate.
 */

/** A single selectable model, already narrowed to the free tier. */
export interface ModelOption {
  /** The OpenRouter id, e.g. "google/gemma-3-27b-it:free". This is what gets stored. */
  id: string;
  /** Display name with the provider prefix and the "(free)" suffix stripped off. */
  name: string;
  /** The slug before the first "/", e.g. "google" — the panel maps it to an insignia. */
  provider: string;
  /** A readable provider name, e.g. "Google", derived server-side. */
  providerName: string;
  /** Context window in tokens; shown as the model's "range". */
  contextLength: number;
  /** True when the model also accepts images, not text alone. */
  vision: boolean;
}

export interface ModelCatalog {
  models: ModelOption[];
  /**
   * False only when the live list could not be fetched and no cached list
   * exists, so the panel should fall back to manual id entry.
   */
  live: boolean;
}
