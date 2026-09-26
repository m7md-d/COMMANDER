/**
 * What a push changed, file by file — the only evidence a check may charge on.
 *
 * Read from the push's own branch, between the head it replaced and the head it
 * made. Never from the stored snapshot: that follows one branch and moves with
 * whatever landed there, and judging its movements charged pushes with work
 * done on other branches (scenarios in `checks.test.ts`). Pure, so the worker
 * and the scenario reference measure a push the same way.
 */

import type { NormalizedPush } from "@commander/shared";
import { diffListings, type TouchedFile, type TreeEntry } from "@/domain/tree/diff.js";

const ZERO = /^0+$/;
const known = (sha: string | undefined): string | undefined => (sha && !ZERO.test(sha) ? sha : undefined);

/**
 * The two commits a push's changes are measured between: `base`, what the
 * branch held before it, and `head`, what it holds after. A new branch — and a
 * push the reconciler rebuilt, which knows no `before` — is measured from where
 * its oldest new commit was made. Null when either end cannot be known: nothing
 * is then measured, and nothing charged.
 */
export function pushSpan(push: NormalizedPush): { base: string; head: string } | null {
  if (push.deleted) return null;
  const head = known(push.after) ?? push.commits[push.commits.length - 1]?.sha;
  const base = known(push.before) ?? push.commits[0]?.parents?.[0];
  return head && base ? { base, head } : null;
}

/**
 * Every file that differs between the push's two trees, with the blob it
 * replaced. A file the push moved keeps the blob it had at its old path —
 * followed through the push's own moves, and failing those, recognised by its
 * unchanged content. Without that, a file moved while already over its limit
 * reads as created over it: a crossing charged to whoever moved it
 * (scenarios `long-file-moved`, `long-file-moved-and-edited`).
 */
export function pushChanges(input: { before: TreeEntry[]; after: TreeEntry[]; push: NormalizedPush }): TouchedFile[] {
  const { before, after, push } = input;
  const was = new Map(before.map((entry) => [entry.path, entry.sha]));
  const contents = new Set(before.map((entry) => entry.sha));
  const origin = movedFrom(push);

  return diffListings(before, after).touched.map((file) => {
    if (file.previousSha !== null) return file;
    const from = origin.get(file.path);
    const previous = (from === undefined ? undefined : was.get(from)) ?? (contents.has(file.sha) ? file.sha : undefined);
    return previous === undefined ? file : { ...file, previousSha: previous };
  });
}

/** Where each path the push moved a file to came from, followed through its moves in order. */
function movedFrom(push: NormalizedPush): Map<string, string> {
  const origin = new Map<string, string>();
  for (const commit of push.commits) {
    for (const [from, to] of commit.moves ?? []) origin.set(to, origin.get(from) ?? from);
  }
  return origin;
}
