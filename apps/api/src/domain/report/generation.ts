/**
 * What follows the model's answer, and what a rewrite asks of it (0012). Pure
 * (§2): the worker acts on these, and the tests read them without a model.
 */

import { t, type LocaleId } from "@commander/shared";
import { sanitizeQuote } from "./sanitize.js";

export type AfterGeneration =
  | { send: true; reason: "ok" | "llm_failed" }
  | {
      send: false;
      reason: "llm_held";
      error: string;
      retryable: boolean;
      retryAfterSeconds?: number;
      /** The provider's fields as they came (`failureDetail`), for the row's `reason_detail`. */
      detail?: Record<string, string | number>;
    };

/**
 * A report the model did not write is not replaced. It once was, by a fallback
 * sentence sent at once — a line of routine where the team waited for a report,
 * with no way to ask for the real one after. Now nothing is sent: the outbox
 * retries what waiting can mend (a rate limit, a timeout), and holds the rest
 * with its reason, for the resend button.
 */
export function afterGeneration(result: {
  llmOk: boolean;
  llmError: string | null;
  llmRetryable: boolean;
  /** The wait the provider asked for (`Retry-After`), which the outbox honours over its own backoff. */
  llmRetryAfterSeconds?: number | null;
  llmFailure?: Record<string, string | number> | null;
  /**
   * The report stands without the model's prose — the weekly digest, whose
   * measured facts are the report. It goes out on them, marked `llm_failed`.
   */
  proseOptional?: boolean;
}): AfterGeneration {
  if (result.llmOk) return { send: true, reason: "ok" };
  if (result.proseOptional) return { send: true, reason: "llm_failed" };
  const wait = result.llmRetryAfterSeconds ?? null;
  const detail = result.llmFailure ?? null;
  return {
    send: false,
    reason: "llm_held",
    error: result.llmError ?? "unknown",
    retryable: result.llmRetryable,
    ...(wait !== null && { retryAfterSeconds: wait }),
    ...(detail !== null && { detail }),
  };
}

/**
 * What the model's answer means for the report: written, or why not and when
 * to ask again. Takes the answer's shape rather than the client's type, so the
 * domain stays free of the integration it describes.
 */
export function llmOutcome(
  completion:
    | { ok: true }
    | { ok: false; error: string; retryable: boolean; retryAfterSeconds?: number; failure?: Record<string, string | number> },
) {
  return completion.ok
    ? { llmOk: true, llmError: null, llmRetryable: false, llmRetryAfterSeconds: null, llmFailure: null }
    : {
        llmOk: false,
        llmError: completion.error,
        llmRetryable: completion.retryable,
        llmRetryAfterSeconds: completion.retryAfterSeconds ?? null,
        llmFailure: completion.failure ?? null,
      };
}

/** A sent report is quoted whole — long enough for any communiqué, short enough to bound the prompt. */
const PREVIOUS_MAX = 4000;

/**
 * The user prompt of a report asked for again after it was sent: the same
 * facts, and a note that this is a rewrite with the text that went out. The
 * text is the model's own, but it quoted commit titles, so it is stripped of
 * what could close a tag like any other quote.
 */
export function withRewrite(userPrompt: string, rewrite: { locale: LocaleId; previous: string | null }): string {
  if (rewrite.previous === null) return userPrompt;
  const previous = sanitizeQuote(rewrite.previous, { maxLength: PREVIOUS_MAX, guardEnabled: true });
  return `${userPrompt}\n\n${t(rewrite.locale, "report.rewrite", { previous })}`;
}
