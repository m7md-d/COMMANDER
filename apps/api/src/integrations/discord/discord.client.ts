/**
 * Discord webhook delivery. Returns a Result; never throws (§6).
 *
 * The status is checked, unlike a fire-and-forget POST — a revoked webhook
 * would otherwise fail silently forever with no signal anywhere.
 */

import { DISCORD_TIMEOUT_MS } from "@/config/constants.js";
import { createLogger } from "@/core/logger/logger.js";
import type { DiscordEmbed } from "./embed.builder.js";

const log = createLogger("discord");

export type DiscordResult =
  | { ok: true }
  | { ok: false; status: number; error: string; retryable: boolean; retryAfterSeconds?: number };

interface RateLimitBody {
  retry_after?: number;
}

export async function sendEmbed(webhookUrl: string, embed: DiscordEmbed): Promise<DiscordResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCORD_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (response.ok) return { ok: true };

    // Discord tells us exactly how long to wait; honouring it is the difference
    // between recovering and getting the webhook banned.
    if (response.status === 429) {
      const body = (await response.json().catch(() => ({}))) as RateLimitBody;
      const retryAfterSeconds = Math.ceil(body.retry_after ?? 60);
      log.warn("rate limited", { retryAfterSeconds });
      return {
        ok: false,
        status: 429,
        error: "rate_limited",
        retryable: true,
        retryAfterSeconds,
      };
    }

    const text = await response.text().catch(() => "");
    // 401/404 mean the webhook was deleted or its token rotated. Retrying
    // cannot fix that, and it would burn attempts until the row is exhausted.
    const retryable = response.status >= 500;
    log.warn("delivery rejected", { status: response.status, retryable });

    return { ok: false, status: response.status, error: text.slice(0, 300), retryable };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      error: aborted ? "timeout" : String(error),
      retryable: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}
