import type { LazyMessageRuleConfig } from "@commander/shared";
import type { RuleEvaluator } from "../types.js";

/** `feat(scope)!: ` — stripped so the prefix does not count toward length. */
const CONVENTIONAL_PREFIX = /^(\w+)(\([^)]*\))?!?:\s*/;
const TRAILING_PUNCTUATION = /[.!؟?]+$/;

function normalize(title: string): string {
  return title.toLowerCase().replace(TRAILING_PUNCTUATION, "").trim().replace(CONVENTIONAL_PREFIX, "");
}

/**
 * Without stripping the Conventional Commits prefix, a disciplined `fix: x` is
 * six characters and gets flagged — punishing exactly the convention we would
 * want to encourage.
 */
export const lazyMessageRule: RuleEvaluator<LazyMessageRuleConfig> = ({ push }, config) => {
  const words = config.words.map((word) => word.toLowerCase());

  for (const commit of push.commits) {
    const body = normalize(commit.title);
    if (!body) continue;
    if (body.length < config.minLength || words.includes(body)) {
      return { sample: commit.title };
    }
  }

  return null;
};
