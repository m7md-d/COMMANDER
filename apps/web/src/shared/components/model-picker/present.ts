import type { ModelOption } from "@commander/shared";

/** Context window as a compact "range": 32768 → "32K", 8192 → "8K". */
export function formatRange(tokens: number): string {
  if (tokens <= 0) return "—";
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

/** Case-insensitive search across id, display name and provider name. */
export function filterModels(models: ModelOption[], query: string): ModelOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return models;
  return models.filter(
    (model) =>
      model.id.toLowerCase().includes(q) ||
      model.name.toLowerCase().includes(q) ||
      model.providerName.toLowerCase().includes(q),
  );
}
