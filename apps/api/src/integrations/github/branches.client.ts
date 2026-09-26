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
}

/** Pages of 100. A repository with more branches is listed in part, and says so. */
const BRANCH_PAGES = 10;

/**
 * The repository's branch names: what a watched pattern is matched against,
 * since a pattern is not a branch the commits API can read. `complete` is false
 * when the listing stopped at the page cap, so a partial list never reads as
 * the whole.
 */
export async function listBranches(
  installationId: string,
  repoFullName: string,
): Promise<Result<{ names: string[]; complete: boolean }>> {
  const names: string[] = [];

  for (let page = 1; page <= BRANCH_PAGES; page += 1) {
    const result = await request<RawBranch[]>(
      installationId,
      `/repos/${repoFullName}/branches?per_page=100&page=${page}`,
    );
    if (!result.ok) return result;
    names.push(...result.data.flatMap((branch) => (branch.name ? [branch.name] : [])));
    if (result.data.length < 100) return { ok: true, data: { names, complete: true } };
  }

  return { ok: true, data: { names, complete: false } };
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
  total_commits?: number;
  commits?: RawListCommit[];
}

/** A branch name as a path: each segment escaped, the slashes between them kept. */
const asPath = (branch: string): string => branch.split("/").map(encodeURIComponent).join("/");

/**
 * What `head` has beyond `base`, oldest first — the work pushed to a branch past
 * the one it was cut from. GitHub's docs: the `git log BASE..HEAD` set, in
 * chronological order, at most 250 without paging. `complete` is false when
 * `total_commits` says there were more.
 */
export async function compareCommits(input: {
  installationId: string;
  repoFullName: string;
  base: string;
  head: string;
}): Promise<Result<{ commits: CommitListEntry[]; complete: boolean }>> {
  const { installationId, repoFullName, base, head } = input;
  const result = await request<RawCompare>(
    installationId,
    `/repos/${repoFullName}/compare/${asPath(base)}...${asPath(head)}`,
  );
  if (!result.ok) return result;

  const commits = (result.data.commits ?? []).map(toCommitListEntry);
  return { ok: true, data: { commits, complete: commits.length >= (result.data.total_commits ?? 0) } };
}
