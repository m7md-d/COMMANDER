/**
 * Discord's error body, read: `{ message, code, errors? }`, and on a 429
 * `{ message, retry_after (seconds, float), global }` with `Retry-After` and
 * `X-RateLimit-Scope` headers (https://docs.discord.com/developers/topics/rate-limits,
 * .../topics/opcodes-and-status-codes). The JSON code is what tells a deleted
 * webhook (10015) from an invalid token (50027) or a malformed embed (50035).
 */

import { oneLine, parseBody, secondsOf, type ProviderAnswer, type ProviderFailure } from "../provider-failure.js";

interface ErrorBody {
  message?: string;
  code?: number;
  retry_after?: number;
  global?: boolean;
}

export function readDiscordFailure(answer: ProviderAnswer): ProviderFailure {
  const body = parseBody(answer.text) as ErrorBody | null;
  const waits = [secondsOf(body?.retry_after), secondsOf(answer.header("retry-after"))].filter((seconds): seconds is number => seconds !== null);

  return {
    provider: "discord",
    status: answer.status,
    code: body?.code !== undefined ? String(body.code) : null,
    message: oneLine(body?.message ?? answer.text) || `http_${answer.status}`,
    upstream: null,
    detail: answer.header("x-ratelimit-scope") ?? (body?.global ? "global" : null),
    retryAfterSeconds: waits.length > 0 ? Math.max(...waits) : null,
    quota: null,
  };
}
