/**
 * OpenRouter's error body, read (https://openrouter.ai/docs/api-reference/errors):
 * `{ error: { code, message, metadata? } }`. The metadata is what names the
 * cause — `error_type` (the canonical vocabulary: rate_limit_exceeded,
 * payment_required, provider_overloaded…), `provider_name` and `raw` for an
 * upstream's own refusal, `reasons` for moderation — and the free-model quota
 * travels as X-RateLimit-* headers, sometimes repeated inside `metadata.headers`
 * (https://openrouter.ai/docs/api-reference/limits).
 */

import { oneLine, parseBody, quotaOf, secondsOf, type ProviderAnswer, type ProviderFailure } from "../provider-failure.js";

interface ErrorBody {
  error?: {
    message?: string;
    metadata?: {
      error_type?: string;
      provider_code?: string;
      provider_name?: string;
      raw?: unknown;
      reasons?: string[];
      headers?: Record<string, string>;
    };
  };
}

export function readOpenRouterFailure(answer: ProviderAnswer): ProviderFailure {
  const body = parseBody(answer.text) as ErrorBody | null;
  const error = body?.error;
  const metadata = error?.metadata;
  const carried = new Map(Object.entries(metadata?.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]));
  const raw = typeof metadata?.raw === "string" ? metadata.raw : metadata?.raw === undefined ? null : JSON.stringify(metadata.raw);

  return {
    provider: "openrouter",
    status: answer.status,
    code: metadata?.error_type ?? null,
    message: oneLine(error?.message ?? answer.text) || `http_${answer.status}`,
    upstream: metadata?.provider_name ?? null,
    detail: raw !== null ? oneLine(raw) : metadata?.reasons?.join(", ") ?? metadata?.provider_code ?? null,
    retryAfterSeconds: secondsOf(answer.header("retry-after")),
    quota: quotaOf((name) => answer.header(name) ?? carried.get(name) ?? null),
  };
}
