/**
 * The normalized push. Every layer downstream of the webhook speaks this shape
 * and never GitHub's raw payload, so a change in GitHub's field names is
 * contained to one mapper.
 */

export interface NormalizedCommit {
  sha: string;
  title: string;
  url: string;
  timestamp: string;
  filesAdded: number;
  filesRemoved: number;
  filesModified: number;
  authorLogin: string;
  committerLogin: string;
  /**
   * Lines changed. Undefined until enrichment asks GitHub for them: neither the
   * push webhook nor the commits list carries line counts, and reporting a zero
   * we never measured is what made a 674-line commit read as "صفر أسطر".
   */
  additions?: number;
  deletions?: number;
}

export interface NormalizedPush {
  repoFullName: string;
  repoUrl: string;
  branch: string;
  ref: string;
  forced: boolean;
  created: boolean;
  deleted: boolean;
  compareUrl: string;
  actorLogin: string;
  actorAvatarUrl: string;
  commits: NormalizedCommit[];
  /**
   * GitHub caps `commits` at 20 entries per push payload. When true, counters
   * built from commits.length are known to be low and the report says so.
   */
  truncated: boolean;
}

/**
 * Commits authored through the GitHub web UI — every PR merge, squash and
 * rebase — carry `web-flow` as committer. It is the only in-payload signal that
 * a push arrived via a pull request; matching a "Merge ..." message prefix
 * misses squash and rebase entirely.
 */
export const GITHUB_UI_COMMITTER = "web-flow";

export function isGitHubUiCommit(commit: NormalizedCommit): boolean {
  return commit.committerLogin === GITHUB_UI_COMMITTER;
}

export function isMergeCommit(commit: NormalizedCommit): boolean {
  return /^merge\b/i.test(commit.title);
}

export function totalFilesTouched(commits: NormalizedCommit[]): number {
  return commits.reduce(
    (sum, commit) => sum + commit.filesAdded + commit.filesRemoved + commit.filesModified,
    0,
  );
}
