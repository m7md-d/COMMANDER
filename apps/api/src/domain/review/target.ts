/**
 * What a push's code review reads, if anything (0009 §7).
 *
 * A review is a model's opinion, and it was paid for per commit: a push of ten
 * commits cost ten requests, and a merge was reviewed as one giant commit in
 * the name of whoever merged it. Now a push is reviewed once, on its net diff —
 * the same two ends its checks are measured between — and only for the work it
 * brought. A landing whose branch is already on record brings nothing but its
 * merge, and was reviewed when the branch was pushed.
 *
 * Filed under the one author of that work, for the dossier; under nobody when
 * several wrote it. A review is not a charge, and naming whoever is nearest is
 * how a merger came to own a branch's review.
 */

import { isMerge, type NormalizedPush } from "@commander/shared";
import { pushSpan } from "@/domain/judgement/changes.js";

export interface ReviewTarget {
  base: string;
  head: string;
  /** Whose work it was, when one person's; null when several wrote it. */
  login: string | null;
  /** Everyone whose work it was, for the reviewer to read. */
  authors: string[];
  /** The newest commit's title, which names the work in the dossier. */
  title: string;
}

export function reviewTarget(input: { push: NormalizedPush; fresh: readonly string[] }): ReviewTarget | null {
  const fresh = new Set(input.fresh);
  const work = input.push.commits.filter((commit) => fresh.has(commit.sha) && !isMerge(commit));
  const newest = work.at(-1);
  const span = pushSpan(input.push);
  if (!newest || !span) return null;

  const hands = new Set(work.map((commit) => commit.authorLogin || null));
  const login = hands.size === 1 ? ([...hands][0] ?? null) : null;
  const authors = [...hands].flatMap((author) => (author === null ? [] : [author]));
  return { ...span, login, authors, title: newest.title };
}
