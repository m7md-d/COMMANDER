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
  | { ok: false; error: string; model: string; retryable: boolean };

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
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

export async function requestCompletion(request: CompletionRequest): Promise<CompletionResult> {
  if (!env.OPENROUTER_API_KEY) {
    return { ok: false, error: "missing_api_key", model: request.model, retryable: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const response = await postCompletion(request, controller.signal);
    const body = (await response.json()) as OpenRouterResponse;

    if (!response.ok) {
      const message = body.error?.message ?? `http_${response.status}`;
      log.warn("completion rejected", { status: response.status, model: request.model });
      return {
        ok: false,
        error: message,
        model: request.model,
        retryable: isRetryableStatus(response.status),
      };
    }

    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) {
      // A retired free model answers 200 with an empty choice list rather than
      // a 404, so this branch is the common failure in practice.
      return { ok: false, error: "empty_response", model: request.model, retryable: true };
    }

    return { ok: true, text, model: request.model, usage: reportUsage(request, body) };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    log.warn("completion failed", { model: request.model, aborted });
    return {
      ok: false,
      error: aborted ? "timeout" : String(error),
      model: request.model,
      retryable: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}
