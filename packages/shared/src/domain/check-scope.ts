/**
 * Which paths a check is entitled to judge.
 *
 * Split from the metrics themselves because it answers a different question:
 * `checks.ts` decides what a measurement *means*, this decides whether a file is
 * ours to measure at all. Keeping them apart is also what keeps the pattern
 * language small — the moment scope lives beside thresholds, somebody adds brace
 * expansion to save one line of config.
 */

export interface CheckScope {
  include: string[];
  exclude: string[];
}

/** Regex specials except `*`, which the translation below gives meaning to. */
const SPECIAL = /[.+^${}()|[\]\\?]/g;

function toRegExp(pattern: string): RegExp {
  const parts = pattern.split("/");
  let source = "";

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? "";
    const last = index === parts.length - 1;

    if (part === "**") {
      // Trailing `**` swallows the rest of the path. Otherwise it stands for any
      // number of segments *including none*, so `**/*.ts` matches a file at the
      // root as readily as one ten directories down — which is what everybody
      // means when they write it.
      source += last ? ".*" : "(?:[^/]*/)*";
      continue;
    }

    source += part.replace(SPECIAL, "\\$&").replace(/\*/g, "[^/]*");
    if (!last) source += "/";
  }

  return new RegExp(`^${source}$`);
}

/** `*` matches within one path segment; `**` crosses them. No brace expansion —
 *  a pattern language nobody can predict is worse than a small one. */
export function matchesGlob(pattern: string, path: string): boolean {
  return toRegExp(pattern).test(path);
}

export function inScope(scope: CheckScope, path: string): boolean {
  if (!scope.include.some((pattern) => matchesGlob(pattern, path))) return false;
  return !scope.exclude.some((pattern) => matchesGlob(pattern, path));
}

