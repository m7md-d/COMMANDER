/**
 * What a completion actually cost, as the provider reported it.
 *
 * Split from the client for the same reason `review.build.ts` is split from its
 * service: this is a pure reading of an untrusted shape, and the client cannot
 * be imported without booting the validated environment. A number this small
 * should be testable without a database URL.
 *
 * Read rather than estimated, because characters-per-token is not a constant and
 * this project makes that unusually true: the communiqué and review instructions
 * are Arabic, which tokenizes far worse than the ASCII source they carry. A
 * budget written in characters can only be checked against a context window
 * through a ratio, and the only honest ratio is a measured one.
 */

export interface RawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

export interface CompletionUsage {
  promptTokens: number;
  completionTokens: number;
}

/**
 * Null when the provider reported nothing usable — never zero.
 *
 * Zero is a measurement ("this cost no tokens") and would average into a ratio
 * as though somebody had observed it. Some OpenRouter upstreams omit `usage`
 * altogether, so the absent case is ordinary and has to stay distinguishable
 * from a real reading.
 */
export function readUsage(body: { usage?: RawUsage }): CompletionUsage | null {
  const prompt = body.usage?.prompt_tokens;
  if (typeof prompt !== "number" || !Number.isFinite(prompt) || prompt <= 0) return null;

  const completion = body.usage?.completion_tokens;
  const counted = typeof completion === "number" && Number.isFinite(completion);
  return { promptTokens: prompt, completionTokens: counted ? completion : 0 };
}
