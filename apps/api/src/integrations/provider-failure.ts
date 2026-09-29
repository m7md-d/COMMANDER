/**
 * What an external provider said when it refused a request, in one shape for
 * all three — OpenRouter, Discord, GitHub — so a log line or a delivery row
 * says *why*, not only a status.
 *
 * A status alone names nothing. OpenRouter answers 429 for its free daily
 * quota, for its per-minute limit, and for an upstream provider throttling a
 * free model — three causes with three remedies, told apart only by the body
 * and headers that used to be dropped (docs/DEFECTS.md D-32).
 *
 * Pure: each provider's reader (`*.errors.ts`) takes the answer as data, so the
 * documented responses are tested without a network or an environment.
 */

export type Provider = "openrouter" | "discord" | "github";

/** A response as the readers need it: the status, a header lookup, the raw body. */
export interface ProviderAnswer {
  status: number;
  header: (name: string) => string | null;
  text: string;
}

export interface ProviderFailure {
  provider: Provider;
  /** The HTTP status; 0 when nothing answered (timeout, network). */
  status: number;
  /** The provider's own code for it: OpenRouter's `error_type`, Discord's JSON code, GitHub's rate-limit resource. */
  code: string | null;
  /** The provider's words, on one line. */
  message: string;
  /** Behind OpenRouter, the provider that actually refused (`provider_name`). */
  upstream: string | null;
  /** What else it said: an upstream's own message, moderation reasons, a rate-limit scope. */
  detail: string | null;
  /** How long it asked us to wait, in seconds. */
  retryAfterSeconds: number | null;
  /** The quota it says was hit, as it wrote it — its units are the provider's. */
  quota: { limit: string | null; remaining: string | null; reset: string | null } | null;
}

const MESSAGE_MAX = 300;

/** A body as JSON when it is JSON; an error page is not, and must not throw. */
export function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Not JSON — a proxy's HTML, an empty body. The caller keeps the text instead.
    return null;
  }
}

/** One line, bounded: a provider's message goes into a log and a table cell. */
export function oneLine(text: string): string {
  const line = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return line.length > MESSAGE_MAX ? `${line.slice(0, MESSAGE_MAX)}…` : line;
}

/** `Retry-After` in seconds; the HTTP-date form is not sent by these providers. */
export function secondsOf(value: string | number | null | undefined): number | null {
  const seconds = typeof value === "number" ? value : Number(value);
  return value === null || value === undefined || value === "" || !Number.isFinite(seconds) ? null : Math.ceil(seconds);
}

/** The x-ratelimit-* trio when any of it was sent; null when none was. */
export function quotaOf(read: (name: string) => string | null): ProviderFailure["quota"] {
  const quota = { limit: read("x-ratelimit-limit"), remaining: read("x-ratelimit-remaining"), reset: read("x-ratelimit-reset") };
  return quota.limit === null && quota.remaining === null && quota.reset === null ? null : quota;
}

/** One line an operator can act on: who refused, why in their words, and what they asked for. */
export function describeFailure(failure: ProviderFailure): string {
  const { quota } = failure;
  return [
    `${failure.provider} ${failure.status}${failure.code ? ` ${failure.code}` : ""}`,
    failure.upstream,
    failure.detail ? `${failure.message} — ${failure.detail}` : failure.message,
    quota && `quota ${quota.remaining ?? "?"}/${quota.limit ?? "?"}, resets ${quota.reset ?? "?"}`,
    failure.retryAfterSeconds !== null && `retry after ${failure.retryAfterSeconds}s`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** When the request stopped, and whether the provider had begun to answer. */
export interface NetworkTiming {
  elapsedMs: number;
  answered: { status: number; afterMs: number } | null;
}

/**
 * A request that ended with no answer to read: our own timeout, or the
 * connection failing. It used to be `"timeout"` or `"TypeError: fetch failed"`
 * and nothing else — not how long it waited, not whether headers had arrived
 * (a 200 whose body never finished reads the same as silence), and not the
 * reason Node's fetch keeps in `cause` (ECONNRESET, UND_ERR_SOCKET, ENOTFOUND…).
 */
export function readNetworkFailure(provider: Provider, error: unknown, timing: NetworkTiming): ProviderFailure {
  const aborted = error instanceof Error && error.name === "AbortError";
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : null;
  const causeCode = cause && "code" in cause && typeof cause.code === "string" ? cause.code : null;
  const { answered } = timing;
  const state = aborted
    ? answered
      ? `headers ${answered.status} after ${answered.afterMs}ms, body incomplete`
      : "no response headers"
    : cause?.message ?? null;

  return {
    provider,
    status: answered?.status ?? 0,
    code: aborted ? "timeout" : causeCode ?? "network",
    message: aborted ? "aborted" : error instanceof Error ? error.message : String(error),
    upstream: null,
    detail: [state, `after ${timing.elapsedMs}ms`].filter(Boolean).join(" · "),
    retryAfterSeconds: null,
    quota: null,
  };
}

/**
 * The failure as a delivery row keeps it (`reason_detail`), flat and without
 * empty fields: the card shows each under its own heading, as the provider sent
 * it — reworded by nobody.
 */
export function failureDetail(failure: ProviderFailure): Record<string, string | number> {
  const fields: Record<string, string | number | null | undefined> = {
    provider: failure.provider,
    status: failure.status,
    code: failure.code,
    message: failure.message,
    upstream: failure.upstream,
    detail: failure.detail,
    retryAfterSeconds: failure.retryAfterSeconds,
    quotaLimit: failure.quota?.limit,
    quotaRemaining: failure.quota?.remaining,
    quotaReset: failure.quota?.reset,
  };
  return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string | number] => entry[1] !== null && entry[1] !== undefined));
}
