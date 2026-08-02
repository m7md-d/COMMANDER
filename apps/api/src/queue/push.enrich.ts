/**
 * Gives a push its real file and line counts before the rules and the report
 * read it.
 *
 * The webhook payload carries file *paths* but no line counts, and the commits
 * list the reconciler uses carries neither — so a recovered push arrives as all
 * zeroes. Two things then go wrong: the communiqué states that nothing changed,
 * and every rule that counts files (large_diff, batch size) silently under-fires.
 * One API call per commit, before either consumer runs, closes both.
 *
 * Best-effort (§6): with no App, or on any API failure, the push is returned
 * untouched and the report omits line counts rather than inventing them.
 */

import type { NormalizedCommit, NormalizedPush } from "@commander/shared";
import { createLogger } from "@/core/logger/logger.js";
import { isGitHubAppConfigured } from "@/integrations/github/app-auth.js";
import { fetchCommitDetail, type CommitDetail } from "@/integrations/github/github.client.js";

const log = createLogger("push-enrich");

/** GitHub caps a push payload at 20 commits; the same ceiling bounds the cost. */
const MAX_COMMITS = 20;

export async function enrichPush(
  repository: { fullName: string; githubInstallationId: string },
  push: NormalizedPush,
): Promise<NormalizedPush> {
  if (!isGitHubAppConfigured() || !repository.githubInstallationId) return push;
  if (push.commits.length === 0) return push;

  const commits: NormalizedCommit[] = [];
  let enriched = 0;

  for (const commit of push.commits.slice(0, MAX_COMMITS)) {
    const detail = await fetchCommitDetail(
      repository.githubInstallationId,
      repository.fullName,
      commit.sha,
    );

    if (!detail.ok) {
      commits.push(commit);
      continue;
    }

    commits.push(applyDetail(commit, detail.data));
    enriched += 1;
  }

  commits.push(...push.commits.slice(MAX_COMMITS));
  if (enriched > 0) log.info("push enriched", { repo: repository.fullName, enriched });

  return { ...push, commits };
}

/**
 * Line counts always come from the API — nothing else has them. File counts are
 * filled only when the push carries none, so a webhook's own authoritative
 * numbers are never overwritten by a later API view of the same commit.
 */
function applyDetail(commit: NormalizedCommit, detail: CommitDetail): NormalizedCommit {
  const counted = commit.filesAdded + commit.filesRemoved + commit.filesModified;

  return {
    ...commit,
    ...(counted === 0 && countByStatus(detail.files)),
    additions: detail.additions,
    deletions: detail.deletions,
  };
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
