/**
 * What follows the model's answer, and what a rewrite asks of it (0012). Pure
 * (§2): the worker acts on these, and the tests read them without a model.
 */

import { t, type LocaleId } from "@commander/shared";
import { sanitizeQuote } from "./sanitize.js";

export type AfterGeneration =
  | { send: true }
  | { send: false; reason: "llm_held"; error: string; retryable: boolean };

/**
 * A report the model did not write is not replaced. It once was, by a fallback
 * sentence sent at once — a line of routine where the team waited for a report,
 * with no way to ask for the real one after. Now nothing is sent: the outbox
 * retries what waiting can mend (a rate limit, a timeout), and holds the rest
 * with its reason, for the resend button.
 */
export function afterGeneration(result: { llmOk: boolean; llmError: string | null; llmRetryable: boolean }): AfterGeneration {
  if (result.llmOk) return { send: true };
  return { send: false, reason: "llm_held", error: result.llmError ?? "unknown", retryable: result.llmRetryable };
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
