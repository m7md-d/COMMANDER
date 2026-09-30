/**
 * Applying GitHub's view of each commit to a push — the part of enrichment that
 * decides what the rules will read.
 *
 * Split from `push.enrich.ts`, which only wires in the App and the network. The
 * fetch is injected here, so the scenario reference (`src/scenarios/`) can hand
 * this the exact JSON a real repository produces and see what the rules would
 * see, without a token and without the validated environment a client needs.
 */

import type { NormalizedCommit, NormalizedPush } from "@commander/shared";
import type { CommitDetail, CommitFileChange, Result } from "@/integrations/github/github.client.js";

/**
 * Bounds the API calls one push may cost: one request per commit, from an
 * installation's 5,000 an hour. 250 is the most commits GitHub lists for a pull
 * request ("List commits on a pull request"), so any pull request GitHub shows
 * whole is read whole. It was 20 — the cap on GitHub's events *timeline*, not on
 * a push — and a crossing in a push of 21 commits was never seen (D-27). A
 * webhook delivery carries up to 2,048 commits; a longer push is read in part,
 * and says so (`report.unmeasured`).
 */
export const MAX_ENRICHED_COMMITS = 250;

export type DetailFetcher = (sha: string) => Promise<Result<CommitDetail>>;

export async function enrichWith(
  push: NormalizedPush,
  fetchDetail: DetailFetcher,
): Promise<{ push: NormalizedPush; enriched: number }> {
  if (push.commits.length === 0) return { push, enriched: 0 };

  const commits: NormalizedCommit[] = [];
  let enriched = 0;

  for (const commit of push.commits.slice(0, MAX_ENRICHED_COMMITS)) {
    const detail = await fetchDetail(commit.sha);
    if (!detail.ok) {
      commits.push(commit);
      continue;
    }
    commits.push(applyDetail(commit, detail.data));
    enriched += 1;
  }

  commits.push(...push.commits.slice(MAX_ENRICHED_COMMITS));
  return { push: { ...push, commits }, enriched };
}

/**
 * Line counts always come from the API — nothing else has them. File counts are
 * filled only when the push carries none, so a webhook's own authoritative
 * numbers are never overwritten by a later API view of the same commit.
 */
export function applyDetail(commit: NormalizedCommit, detail: CommitDetail): NormalizedCommit {
  const counted = commit.filesAdded + commit.filesRemoved + commit.filesModified;
  const read = {
    ...commit,
    ...(counted === 0 && countByStatus(detail.files)),
    additions: detail.additions,
    deletions: detail.deletions,
    // Both were already in this response and were being dropped. They are what
    // lets a merge be weighed on what it introduced rather than on the whole
    // branch it carries — see weighPush.
    parents: detail.parents,
  };
  // A listing that may have stopped short gives no paths: a path missing from it
  // reads as work nobody did, or as a merge's own. The commit stays unread.
  if (!detail.complete) return read;

  const blobs = blobsAfter(detail.files);
  return {
    ...read,
    paths: touchedPaths(detail.files),
    moves: detail.files.flatMap((file): [string, string][] =>
      file.previousPath === undefined ? [] : [[file.previousPath, file.path]],
    ),
    ...(blobs && { blobs }),
  };
}

/**
 * What each touched file was left holding: its blob, or null where it went — a
 * rename's old path included. Null for the whole commit when any file comes
 * without its blob: a hand read from a partial list could be charged with
 * another's version (0011).
 */
function blobsAfter(files: CommitFileChange[]): [string, string | null][] | null {
  const blobs: [string, string | null][] = [];
  for (const file of files) {
    if (file.previousPath !== undefined) blobs.push([file.previousPath, null]);
    if (file.status === "removed") blobs.push([file.path, null]);
    else if (file.sha) blobs.push([file.path, file.sha]);
    else return null;
  }
  return blobs;
}

/**
 * A rename touches two paths: the one it left and the one it made. Keeping only
 * the new one let a merge's net deletion of the old path read as the merge's own
 * work, and charged whoever merged it (scenario `rename-then-rewrite-merged`).
 */
function touchedPaths(files: CommitFileChange[]): string[] {
  const paths = files.flatMap((file) =>
    file.previousPath === undefined ? [file.path] : [file.path, file.previousPath],
  );
  return [...new Set(paths)];
}

function countByStatus(files: { status: string }[]) {
  const isAdded = (status: string) => status === "added";
  const isRemoved = (status: string) => status === "removed";

  return {
    filesAdded: files.filter((file) => isAdded(file.status)).length,
    filesRemoved: files.filter((file) => isRemoved(file.status)).length,
    // renamed, copied and changed are all edits to a path that already existed.
    filesModified: files.filter((file) => !isAdded(file.status) && !isRemoved(file.status)).length,
  };
}
