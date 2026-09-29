/**
 * GitHub's REST error body, read: `{ message, documentation_url, status }`, with
 * the x-ratelimit-* headers on every response and `retry-after` on a secondary
 * limit (https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).
 * An exhausted primary limit is a 403 or 429 with `x-ratelimit-remaining: 0`;
 * `x-ratelimit-resource` says which, and `x-ratelimit-reset` is epoch seconds.
 */

import { oneLine, parseBody, quotaOf, secondsOf, type ProviderAnswer, type ProviderFailure } from "../provider-failure.js";

interface ErrorBody {
  message?: string;
}

export function readGitHubFailure(answer: ProviderAnswer): ProviderFailure {
  const body = parseBody(answer.text) as ErrorBody | null;
  // Every response carries the quota; it is the cause only when it ran out.
  const exhausted = answer.header("x-ratelimit-remaining") === "0";

  return {
    provider: "github",
    status: answer.status,
    code: exhausted ? answer.header("x-ratelimit-resource") : null,
    message: oneLine(body?.message ?? answer.text) || `http_${answer.status}`,
    upstream: null,
    detail: null,
    retryAfterSeconds: secondsOf(answer.header("retry-after")),
    quota: exhausted ? quotaOf(answer.header) : null,
  };
}
