/**
 * OpenRouter model catalogue. A separate concern from chat completions: the
 * endpoint is public (no key needed), read-only, and its shape is unrelated.
 *
 * CONSTITUTION.md §6: returns a Result, never throws. A slow or unreachable
 * catalogue degrades the picker to manual entry — it is an expected outcome, not
 * an exception the caller must catch.
 */

import { OPENROUTER_MODELS_ENDPOINT, OPENROUTER_TIMEOUT_MS } from "@/config/constants.js";
import { env } from "@/config/env.js";
import { createLogger } from "@/core/logger/logger.js";

const log = createLogger("openrouter-models");

/** The fields of an OpenRouter model entry the catalogue reads; the rest is ignored. */
export interface RawModel {
  id: string;
  name?: string;
  context_length?: number;
  architecture?: { input_modalities?: string[]; output_modalities?: string[]; modality?: string };
  pricing?: { prompt?: string; completion?: string };
}

export type ModelsResult = { ok: true; models: RawModel[] } | { ok: false; error: string };

export async function fetchOpenRouterModels(): Promise<ModelsResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    // `order=top-weekly` is OpenRouter's own most-used ranking — the same order
    // their site's leaderboard shows. We keep that order rather than re-sorting,
    // so "popular" means what OpenRouter says it means.
    const response = await fetch(`${OPENROUTER_MODELS_ENDPOINT}?order=top-weekly`, {
      signal: controller.signal,
      // The key is not required here, but sending it when present keeps the
      // request on the account's rate-limit tier rather than the anonymous one.
      headers: env.OPENROUTER_API_KEY ? { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` } : {},
    });

    if (!response.ok) {
      log.warn("model list rejected", { status: response.status });
      return { ok: false, error: `http_${response.status}` };
    }

    const body = (await response.json()) as { data?: RawModel[] };
    return { ok: true, models: body.data ?? [] };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    log.warn("model list failed", { aborted });
    return { ok: false, error: aborted ? "timeout" : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}
