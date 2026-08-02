/**
 * Outbox job lifecycle, shared so the panel renders the same states the worker
 * writes. These strings are persisted in Postgres as enums — renaming one is a
 * migration, not a refactor.
 */

export const DELIVERY_STATUSES = ["pending", "processing", "sent", "failed", "skipped"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/**
 * Why a delivery ended where it did. Every value is an i18n key suffix resolved
 * under `delivery.reason.*` — the API never returns prose (CONSTITUTION.md §3).
 */
export const DELIVERY_REASONS = [
  "ok",
  "repo_not_configured",
  "repo_disabled",
  "branch_not_watched",
  "no_commits",
  "clean_and_silent",
  "system_paused",
  "not_a_branch",
  "discord_missing",
  "discord_failed",
  "discord_rate_limited",
  "llm_failed",
  "unknown",
] as const;

export type DeliveryReason = (typeof DELIVERY_REASONS)[number];

/** Terminal reasons never retry: retrying cannot change the outcome. */
export const NON_RETRYABLE_REASONS: readonly DeliveryReason[] = [
  "ok",
  "repo_not_configured",
  "repo_disabled",
  "branch_not_watched",
  "no_commits",
  "clean_and_silent",
  "system_paused",
  "not_a_branch",
  "discord_missing",
];

export const MAX_RETRY_ATTEMPTS = 5;

/**
 * Exponential backoff with a ceiling: 30s, 2m, 8m, 32m, 60m.
 * Discord rate limits and OpenRouter free-tier queues both recover on this
 * timescale; retrying faster only burns quota.
 */
export function retryDelayMs(attempt: number): number {
  const base = 30_000 * 4 ** Math.max(0, attempt - 1);
  return Math.min(base, 3_600_000);
}
