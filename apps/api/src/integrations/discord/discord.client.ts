/**
 * Discord webhook delivery. Returns a Result; never throws (§6).
 *
 * The status is checked, unlike a fire-and-forget POST — a revoked webhook
 * would otherwise fail silently forever with no signal anywhere.
 */

import { DISCORD_TIMEOUT_MS } from "@/config/constants.js";
import { createLogger } from "@/core/logger/logger.js";
import { describeFailure, failureDetail, readNetworkFailure, type NetworkTiming } from "../provider-failure.js";
import { readDiscordFailure } from "./discord.errors.js";
import type { DiscordEmbed } from "./embed.builder.js";

const log = createLogger("discord");

export type DiscordResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      error: string;
      retryable: boolean;
      retryAfterSeconds?: number;
      /** What Discord said, field by field, for the delivery row to keep (`failureDetail`). */
      failure: Record<string, string | number>;
    };

export async function sendEmbed(webhookUrl: string, embed: DiscordEmbed): Promise<DiscordResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCORD_TIMEOUT_MS);
  const started = Date.now();
  let answered: NetworkTiming["answered"] = null;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
    answered = { status: response.status, afterMs: Date.now() - started };

    if (response.ok) return { ok: true };

    const text = await response.text().catch(() => "");
    const failure = readDiscordFailure({ status: response.status, header: (name) => response.headers.get(name), text });
    // Discord says how long to wait, and honouring it is the difference between
    // recovering and getting the webhook banned. 401/404 mean the webhook was
    // deleted or its token rotated (10015, 50027): retrying cannot fix that, and
    // repeating it counts toward Discord's invalid-request ban.
    const limited = response.status === 429;
    const retryable = limited || response.status >= 500;
    log.warn(limited ? "rate limited" : "delivery rejected", { ...failure, retryable });

    return {
      ok: false,
      status: response.status,
      error: describeFailure(failure),
      retryable,
      failure: failureDetail(failure),
      ...(limited && { retryAfterSeconds: failure.retryAfterSeconds ?? 60 }),
    };
  } catch (error) {
    const failure = readNetworkFailure("discord", error, { elapsedMs: Date.now() - started, answered });
    log.warn("delivery failed", { ...failure });
    return { ok: false, status: failure.status, error: describeFailure(failure), retryable: true, failure: failureDetail(failure) };
  } finally {
    clearTimeout(timeout);
  }
}
