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
  /** The GitHub account the commit's author address belongs to; empty when it belongs to none. */
  authorLogin: string;
  committerLogin: string;
  /**
   * GitHub's own answer to "is this new work": false when the commit had
   * already been pushed to this repository, on any branch. Only the push
   * webhook carries it — a recovered push and a row queued before it was read
   * leave it undefined, and the record alone then decides what is new.
   */
  distinct?: boolean;
  /**
   * Lines changed. Undefined until enrichment asks GitHub for them: neither the
   * push webhook nor the commits list carries line counts, and reporting a zero
   * we never measured is what made a 674-line commit read as "صفر أسطر".
   */
  additions?: number;
  deletions?: number;
  /**
   * Parent shas. Two or more means a merge. Undefined until enrichment asks
   * GitHub, because the push payload does not carry them — and without them a
   * merge can only be guessed at from its title, which squash and rebase merges
   * do not have and any commit can imitate.
   */
  parents?: string[];
  /**
   * The paths this commit touched — both sides of a rename. Undefined until
   * enrichment: the push payload carries them but the mapper keeps only counts,
   * and the API view is the one that also covers a reconciled push. Needed to
   * answer what a merge commit contains that the commits it brings in do not.
   */
  paths?: string[];
  /**
   * Files this commit moved, as [from, to], from GitHub's `previous_filename`.
   * Undefined until enrichment. What lets a moved file keep its history: without
   * it, a file moved while over a limit reads as created over it — a crossing
   * charged to whoever moved it.
   */
  moves?: [from: string, to: string][];
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
  /**
   * The branch's head before and after the push, as GitHub sent them — all
   * zeros for a branch created or deleted. Absent from a push the reconciler
   * rebuilt, which has no event to read them from, and from rows queued before
   * the fields existed. What the push changed is measured between these two.
   */
  before?: string;
  after?: string;
  /**
   * The repository's default branch, as the push event names it — one of the
   * main lines work lands on (`isTrunk`). Absent from a recovered push and from
   * rows queued before it was read.
   */
  defaultBranch?: string;
  /**
   * Whoever pushed, and whom the communiqué addresses. On a recovered push
   * nobody is known to have pushed, and this only names the author of its
   * newest commit, for the communiqué to address.
   */
  actorLogin: string;
  actorAvatarUrl: string;
  /**
   * Rebuilt by the reconciler from the branch's history after its webhook was
   * lost. Git records who wrote and who committed each commit, never who
   * pushed it, so a recovered push names no pusher (0009 §4).
   */
  recovered?: true;
  commits: NormalizedCommit[];
  /**
   * GitHub caps `commits` at 20 entries per push payload. When true, counters
   * built from commits.length are known to be low and the report says so.
   */
  truncated: boolean;
}

/**
 * Commits GitHub's web UI writes — every pull request merge, squash and rebase,
 * "Update branch", and the pencil — carry `web-flow` as committer. It says
 * GitHub made the commit, not which button did: a pull request's landing is
 * GitHub's own answer, asked of the commit (`classifyPush`). A merge is two
 * parents (`isMerge`), never a "Merge…" title.
 */
export const GITHUB_UI_COMMITTER = "web-flow";

export function isGitHubUiCommit(commit: NormalizedCommit): boolean {
  return commit.committerLogin === GITHUB_UI_COMMITTER;
}

export function totalFilesTouched(commits: NormalizedCommit[]): number {
  return commits.reduce(
    (sum, commit) => sum + commit.filesAdded + commit.filesRemoved + commit.filesModified,
    0,
  );
}
