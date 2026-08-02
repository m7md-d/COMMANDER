/**
 * Pure mapping between OpenRouter's raw model entries and the panel's catalogue.
 * No I/O — the service owns fetching and caching; this file only shapes data.
 */

import type { ModelOption } from "@commander/shared";
import type { RawModel } from "@/integrations/openrouter/models.client.js";

/** Slug → readable name. An unlisted slug is title-cased from the slug itself. */
const PROVIDER_NAMES: Record<string, string> = {
  google: "Google",
  "meta-llama": "Meta",
  mistralai: "Mistral",
  qwen: "Qwen",
  deepseek: "DeepSeek",
  microsoft: "Microsoft",
  openai: "OpenAI",
  anthropic: "Anthropic",
  nvidia: "NVIDIA",
  nousresearch: "Nous Research",
  moonshotai: "Moonshot AI",
  "x-ai": "xAI",
  cohere: "Cohere",
  huggingfaceh4: "Hugging Face",
  "z-ai": "Z.AI",
  thudm: "THUDM",
  gryphe: "Gryphe",
  openchat: "OpenChat",
  cognitivecomputations: "Cognitive Computations",
  sao10k: "Sao10K",
  liquid: "Liquid",
  tngtech: "TNG",
};

const MAX_MODELS = 80;

/**
 * Meta pseudo-providers that aren't a fixed model: `openrouter/auto` routes to
 * whatever it likes, so its "free" price is not a guarantee. Keep them out of a
 * picker whose whole promise is a free, predictable spokesperson.
 */
const EXCLUDED_PROVIDERS = new Set(["openrouter"]);

function providerName(slug: string): string {
  if (PROVIDER_NAMES[slug]) return PROVIDER_NAMES[slug];
  return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : slug;
}

/** Free means both prompt and completion price are exactly zero — the authoritative signal. */
function isFree(raw: RawModel): boolean {
  const pricing = raw.pricing;
  return !!pricing && pricing.prompt === "0" && pricing.completion === "0";
}

/**
 * The spokesperson must write text and nothing else. OpenRouter lists free image
 * and audio generators whose output is not text — and some (Lyria) that emit
 * audio *and* a text caption, so "includes text" is too loose. Require the
 * output to be text-only. When modality is unstated, assume a text model rather
 * than over-filter.
 */
function isTextOnly(raw: RawModel): boolean {
  const out = raw.architecture?.output_modalities;
  if (out) return out.length > 0 && out.every((modality) => modality === "text");

  const arrow = (raw.architecture?.modality ?? "").split("->");
  const output = arrow.length < 2 ? (arrow[0] ?? "") : (arrow[1] ?? "");
  if (!output) return true;
  return output.includes("text") && !output.includes("audio") && !output.includes("image");
}

/** A model belongs in the catalogue when it is free, writes text only, and isn't a meta router. */
export function isEligible(raw: RawModel): boolean {
  const provider = raw.id.split("/")[0] ?? "";
  return isFree(raw) && isTextOnly(raw) && !EXCLUDED_PROVIDERS.has(provider);
}

/** "Google: Gemma 3 27B (free)" → "Gemma 3 27B". Falls back to the id. */
function cleanName(raw: RawModel): string {
  const base = raw.name ?? raw.id;
  return base.replace(/^[^:]+:\s*/, "").replace(/\s*\(free\)\s*$/i, "").trim() || raw.id;
}

function hasVision(raw: RawModel): boolean {
  const modalities = raw.architecture?.input_modalities;
  if (modalities) return modalities.includes("image");
  return (raw.architecture?.modality ?? "").includes("image");
}

export function toOption(raw: RawModel): ModelOption {
  const provider = raw.id.split("/")[0] ?? "";
  return {
    id: raw.id,
    name: cleanName(raw),
    provider,
    providerName: providerName(provider),
    contextLength: raw.context_length ?? 0,
    vision: hasVision(raw),
  };
}

/**
 * Keep OpenRouter's order — it arrives ranked by their most-used leaderboard —
 * and only bound the length so the payload and the roster stay manageable.
 */
export function capCatalog(options: ModelOption[]): ModelOption[] {
  return options.slice(0, MAX_MODELS);
}
