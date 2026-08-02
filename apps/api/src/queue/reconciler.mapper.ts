/**
 * Rebuilds NormalizedPush objects from REST commit data so a recovered push runs
 * through the exact pipeline a live webhook would.
 *
 * Grouped by author login rather than lumped under one pusher: the original push
 * event is gone, so there is no pusher to name, and grouping keeps each commit
 * attributed to its real author in the dossier. File counts are 0 — the list
 * endpoint carries no file data; the enrichment pass fills line counts once the
 * commit is on record.
 */

import type { NormalizedCommit, NormalizedPush } from "@commander/shared";
import type { CommitListEntry } from "@/integrations/github/commits.client.js";

export function buildSyntheticPushes(
  repo: { fullName: string },
  branch: string,
  commits: CommitListEntry[],
): NormalizedPush[] {
  const byAuthor = new Map<string, CommitListEntry[]>();
  for (const commit of commits) {
    const login = commit.authorLogin || commit.committerLogin || "unknown";
    const bucket = byAuthor.get(login);
    if (bucket) bucket.push(commit);
    else byAuthor.set(login, [commit]);
  }

  const ref = `refs/heads/${branch}`;
  return [...byAuthor].map(([login, entries]) => ({
    repoFullName: repo.fullName,
    repoUrl: `https://github.com/${repo.fullName}`,
    branch,
    ref,
    forced: false,
    created: false,
    deleted: false,
    compareUrl: "",
    actorLogin: login,
    actorAvatarUrl: "",
    commits: entries.map(toCommit),
    truncated: false,
  }));
}

function toCommit(entry: CommitListEntry): NormalizedCommit {
  return {
    sha: entry.sha,
    title: entry.title,
    url: entry.url,
    timestamp: entry.timestamp,
    filesAdded: 0,
    filesRemoved: 0,
    filesModified: 0,
    authorLogin: entry.authorLogin,
    committerLogin: entry.committerLogin,
  };
}
