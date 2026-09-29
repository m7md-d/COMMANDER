/**
 * OpenRouter chat completions.
 *
 * CONSTITUTION.md §6: an external integration returns a Result and never
 * throws. A model being slow, rate limited or retired is an expected outcome,
 * not an exceptional one — the caller decides whether to retry or fall back.
 */

import { OPENROUTER_ENDPOINT, OPENROUTER_TIMEOUT_MS } from "@/config/constants.js";
import { env } from "@/config/env.js";
import { createLogger } from "@/core/logger/logger.js";
import {
  describeFailure,
  failureDetail,
  oneLine,
  parseBody,
  readNetworkFailure,
  type NetworkTiming,
  type ProviderFailure,
} from "../provider-failure.js";
import { readOpenRouterFailure } from "./openrouter.errors.js";
import { readUsage, type CompletionUsage, type RawUsage } from "./openrouter.usage.js";

const log = createLogger("openrouter");

export interface CompletionRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
}

export type CompletionResult =
  | { ok: true; text: string; model: string; usage: CompletionUsage | null }
  | {
      ok: false;
      error: string;
      model: string;
      retryable: boolean;
      retryAfterSeconds?: number;
      /** What the provider said, field by field, for the delivery row to keep (`failureDetail`). */
      failure?: Record<string, string | number>;
    };

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  usage?: RawUsage;
}

/** 429 and 5xx recover on their own; 4xx will not, so retrying wastes quota. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** The wire call itself. Separated so the result handling below reads as one piece. */
function postCompletion(request: CompletionRequest, signal: AbortSignal): Promise<Response> {
  return fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": env.PUBLIC_URL,
      "X-Title": "Commit Commander",
    },
    body: JSON.stringify({
      model: request.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    }),
  });
}

/**
 * Records what the prompt actually cost, beside how long it was.
 *
 * Logged rather than stored: the pair is what establishes the real
 * characters-per-token ratio for a given model, which is the only honest basis
 * for telling an operator whether a budget fits a context window. Nothing reads
 * it yet — see docs/proposals/0008-review-budget-in-settings.md.
 */
function reportUsage(request: CompletionRequest, body: OpenRouterResponse): CompletionUsage | null {
  const usage = readUsage(body);
  if (!usage) return null;

  log.info("completion usage", {
    model: request.model,
    promptTokens: usage.promptTokens,
    promptChars: request.systemPrompt.length + request.userPrompt.length,
    completionTokens: usage.completionTokens,
  });
  return usage;
}

/**
 * A refusal, with what OpenRouter said about it. The status alone was logged
 * once, and a 429 named nothing: the free daily quota, the per-minute limit and
 * an upstream throttling a free model need three different remedies (D-32).
 */
function rejected(request: CompletionRequest, failure: ProviderFailure, retryable: boolean): CompletionResult {
  log.warn("completion rejected", { model: request.model, ...failure });
  return {
    ok: false,
    error: describeFailure(failure),
    model: request.model,
    retryable,
    failure: failureDetail(failure),
    ...(failure.retryAfterSeconds !== null && { retryAfterSeconds: failure.retryAfterSeconds }),
  };
}

/**
 * A 200, read. Its body may still not be a completion: one that arrived as
 * whitespace alone, or cut short, is not JSON, and says so with its size rather
 * than as a parse error.
 */
function completed(request: CompletionRequest, raw: string): CompletionResult {
  const body = parseBody(raw) as OpenRouterResponse | null;
  if (body === null) {
    const failure: ProviderFailure = { provider: "openrouter", status: 200, code: "unparseable_body", message: `${raw.length} bytes, not JSON`, upstream: null, detail: oneLine(raw) || null, retryAfterSeconds: null, quota: null };
    return rejected(request, failure, true);
  }

  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) {
    // A retired free model answers 200 with an empty choice list rather than
    // a 404, so this branch is the common failure in practice.
    return { ok: false, error: "empty_response", model: request.model, retryable: true };
  }
  return { ok: true, text, model: request.model, usage: reportUsage(request, body) };
}

export async function requestCompletion(request: CompletionRequest): Promise<CompletionResult> {
  if (!env.OPENROUTER_API_KEY) {
    return { ok: false, error: "missing_api_key", model: request.model, retryable: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
  const started = Date.now();
  // When the headers came: a timeout after a 200 is a body that never finished,
  // not silence, and the log must be able to say which (D-36).
  let answered: NetworkTiming["answered"] = null;

  try {
    const response = await postCompletion(request, controller.signal);
    answered = { status: response.status, afterMs: Date.now() - started };
    // Read as text before the status: an error page that is not JSON used to
    // throw here, and the status itself was lost to "Unexpected token".
    const raw = await response.text();

    if (!response.ok) {
      const failure = readOpenRouterFailure({ status: response.status, header: (name) => response.headers.get(name), text: raw });
      return rejected(request, failure, isRetryableStatus(response.status));
    }
    return completed(request, raw);
  } catch (error) {
    return rejected(request, readNetworkFailure("openrouter", error, { elapsedMs: Date.now() - started, answered }), true);
  } finally {
    clearTimeout(timeout);
  }
}
