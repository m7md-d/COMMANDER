/**
 * What a repository's branches hold: their names, which one is the default, and
 * what one has beyond another. Split from `commits.client.ts` once the reconciler
 * needed all three to tell a branch's own work from what it inherited. Returns
 * Results, never throws (§6).
 */

import { request, type Result } from "./github.client.js";
import { toCommitListEntry, type RawListCommit } from "./commit.mapper.js";
import type { CommitListEntry } from "./commits.client.js";

interface RawBranch {
  name?: string;
  commit?: { sha?: string };
}

/** Pages of 100. A repository with more branches is listed in part, and says so. */
const BRANCH_PAGES = 10;

/**
 * The repository's branches, each with the sha its head points at: what a
 * watched pattern is matched against, since a pattern is not a branch the
 * commits API can read, and what tells the reconciler a branch moved.
 * `complete` is false when the listing stopped at the page cap, so a partial
 * list never reads as the whole.
 */
export async function listBranches(
  installationId: string,
  repoFullName: string,
): Promise<Result<{ heads: Map<string, string>; complete: boolean }>> {
  const heads = new Map<string, string>();

  for (let page = 1; page <= BRANCH_PAGES; page += 1) {
    const result = await request<RawBranch[]>(
      installationId,
      `/repos/${repoFullName}/branches?per_page=100&page=${page}`,
    );
    if (!result.ok) return result;
    for (const branch of result.data) {
      if (branch.name && branch.commit?.sha) heads.set(branch.name, branch.commit.sha);
    }
    if (result.data.length < 100) return { ok: true, data: { heads, complete: true } };
  }

  return { ok: true, data: { heads, complete: false } };
}

interface RawRepoMeta {
  default_branch?: string;
}

/**
 * The repo's default branch: what the tree snapshot follows when a front names
 * no branch, and what the reconciler reads every other branch against.
 */
export async function fetchDefaultBranch(
  installationId: string,
  repoFullName: string,
): Promise<Result<string>> {
  const result = await request<RawRepoMeta>(installationId, `/repos/${repoFullName}`);
  if (!result.ok) return result;
  return { ok: true, data: result.data.default_branch ?? "" };
}

interface RawCompare {
  /** `ahead` when base is an ancestor of head and head has more. */
  status?: string;
  total_commits?: number;
  commits?: RawListCommit[];
  merge_base_commit?: { sha?: string };
}

/** A branch name as a path: each segment escaped, the slashes between them kept. */
const asPath = (branch: string): string => branch.split("/").map(encodeURIComponent).join("/");

/**
 * What `head` has beyond `base`, oldest first — the work pushed to a branch past
 * the one it was cut from. GitHub's docs: the `git log BASE..HEAD` set, in
 * chronological order, at most 250 without paging. `complete` is false when
 * `total_commits` says there were more. `mergeBase` is where the two last
 * shared history — a landing's branch is judged from there. `ahead` is true when
 * head only added to base: a push that moved a branch forward, not a rewrite.
 */
export async function compareCommits(input: {
  installationId: string;
  repoFullName: string;
  base: string;
  head: string;
}): Promise<Result<{ commits: CommitListEntry[]; complete: boolean; mergeBase: string | null; ahead: boolean }>> {
  const { installationId, repoFullName, base, head } = input;
  const result = await request<RawCompare>(
    installationId,
    `/repos/${repoFullName}/compare/${asPath(base)}...${asPath(head)}`,
  );
  if (!result.ok) return result;

  const commits = (result.data.commits ?? []).map(toCommitListEntry);
  const complete = commits.length >= (result.data.total_commits ?? 0);
  const mergeBase = result.data.merge_base_commit?.sha || null;
  return { ok: true, data: { commits, complete, mergeBase, ahead: result.data.status === "ahead" } };
}
