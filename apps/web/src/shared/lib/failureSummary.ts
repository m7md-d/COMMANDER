/**
 * A provider's refusal as sentences a person reads first — what happened, how
 * long it asked to wait, when its quota renews — each a dictionary key with its
 * values. The raw reply stays exactly as it arrived, behind a button the
 * operator turns on (`rawFailures`). Nothing here says what to do about it: the
 * operator decides.
 *
 * Pure: the card translates and formats; this only picks the sentences.
 */

export interface FailureLine {
  key: string;
  vars?: Record<string, string | number>;
  /** An instant the sentence names, for the card to format in the reader's own clock. */
  at?: string;
}

/** What the status says happened, as a sentence's key. */
function whatHappened(status: number): string {
  if (status === 0) return "failure.says.unreachable";
  if (status === 401 || status === 403) return "failure.says.denied";
  if (status === 402) return "failure.says.credits";
  if (status === 404) return "failure.says.notFound";
  if (status === 429) return "failure.says.rateLimited";
  if (status >= 500) return "failure.says.serverError";
  return "failure.says.refused";
}

export function failureSummary(detail: Record<string, string | number>): FailureLine[] {
  const provider = String(detail["provider"] ?? "");
  const lines: FailureLine[] = [{ key: whatHappened(Number(detail["status"] ?? -1)), vars: { provider, status: detail["status"] ?? "" } }];

  const upstream = detail["upstream"];
  if (upstream !== undefined) lines.push({ key: "failure.says.upstream", vars: { upstream } });
  const wait = detail["retryAfterSeconds"];
  if (wait !== undefined) lines.push({ key: "failure.says.retryAfter", vars: { seconds: wait } });
  const reset = detail["quotaReset"] === undefined ? null : resetInstant(detail["quotaReset"]);
  if (reset) lines.push({ key: "failure.says.resets", at: reset.toISOString() });
  return lines;
}

/**
 * The instant a quota renews. OpenRouter sends milliseconds, GitHub seconds, and
 * neither says which: a number past 10¹² is milliseconds — seconds that large
 * are thirty thousand years away. Anything else is not a time.
 */
export function resetInstant(value: string | number): Date | null {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return new Date(number > 1e12 ? number : number * 1_000);
}
