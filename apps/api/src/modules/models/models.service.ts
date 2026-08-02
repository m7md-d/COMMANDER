/**
 * The free-model catalogue for the panel's picker.
 *
 * Cached in-process: the list changes on the order of days, and an external
 * fetch on every settings-page open would be both slow and wasteful. On a fetch
 * failure a stale cache is served if one exists — a slightly old catalogue beats
 * none — and only a cold failure returns `live: false`, the panel's cue to fall
 * back to manual id entry.
 */

import type { ModelCatalog } from "@commander/shared";
import { fetchOpenRouterModels } from "@/integrations/openrouter/models.client.js";
import { createLogger } from "@/core/logger/logger.js";
import { capCatalog, isEligible, toOption } from "./models.mapper.js";

const log = createLogger("models");
const CACHE_TTL_MS = 30 * 60 * 1_000;

let cache: { at: number; catalog: ModelCatalog } | null = null;

export async function listModels(): Promise<ModelCatalog> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.catalog;

  const result = await fetchOpenRouterModels();
  if (!result.ok) {
    if (cache) return cache.catalog;
    return { models: [], live: false };
  }

  const models = capCatalog(result.models.filter(isEligible).map(toOption));
  const catalog: ModelCatalog = { models, live: true };
  cache = { at: Date.now(), catalog };
  log.info("model catalogue refreshed", { count: models.length });
  return catalog;
}
