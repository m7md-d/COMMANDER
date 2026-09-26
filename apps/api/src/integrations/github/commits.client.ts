/**
 * REST reads used by the outbox reconciler to recover pushes that arrived while
 * the server was offline. The push webhook for those was never received, so the
 * repository's own commit history is the only surviving record. Returns Results,
 * never throws (§6) — a failed catch-up must never disturb live delivery.
 */

import { request, type Result } from "./github.client.js";
import { toCommitListEntry, type RawListCommit } from "./commit.mapper.js";

export interface CommitListEntry {
  sha: string;
  url: string;
  title: string;
  timestamp: string;
  authorLogin: string;
  committerLogin: string;
}

/**
 * Commits on `branch` pushed at or after `since`, newest first. The list
 * endpoint carries no file stats, so file counts are unknown here; the
 * enrichment pass backfills line counts once the commit is on record.
 */
export async function listCommits(input: {
  installationId: string;
  repoFullName: string;
  branch: string;
  since: Date;
}): Promise<Result<CommitListEntry[]>> {
  const { installationId, repoFullName, branch, since } = input;
  const params = new URLSearchParams({
    sha: branch,
    since: since.toISOString(),
    per_page: "100",
  });

  const result = await request<RawListCommit[]>(
    installationId,
    `/repos/${repoFullName}/commits?${params.toString()}`,
  );
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(toCommitListEntry) };
}

interface RawCommitObject {
  tree?: { sha?: string };
}

/**
 * The tree a commit points at, by `GET /git/commits/{sha}`. The trees endpoint
 * documents a tree sha or a ref name; a commit sha is not in that list, so it is
 * resolved here first rather than trusted to work.
 */
export async function fetchCommitTree(
  installationId: string,
  repoFullName: string,
  commitSha: string,
): Promise<Result<string>> {
  const result = await request<RawCommitObject>(installationId, `/repos/${repoFullName}/git/commits/${commitSha}`);
  if (!result.ok) return result;
  const tree = result.data.tree?.sha;
  return tree ? { ok: true, data: tree } : { ok: false, error: "no_tree", notFound: false };
}

interface RawTree {
  sha: string;
  truncated?: boolean;
  tree?: { path?: string; type?: string; sha?: string; size?: number }[];
}

/** One blob in the listing. */
export interface RepoTreeEntry {
  path: string;
  /** The blob sha — a hash of the content, so it is at once the signal that the
   *  file changed and the key its measurement is stored under. */
  sha: string;
  /** Byte length, which the listing gives away for free. */
  bytes: number;
}

export interface RepoTree {
  /** Tree sha — the invalidation signal, exactly as a blob sha is for a file. */
  sha: string;
  /** Blobs only; directories are implied by the paths themselves. */
  entries: RepoTreeEntry[];
  /** GitHub caps a recursive tree; a partial listing must not read as complete. */
  truncated: boolean;
}

/**
 * The repository's file listing, used to teach the reporter where things live.
 * One recursive call rather than walking directories: a repo of any size is a
 * single request, and GitHub flags truncation itself.
 */
export async function fetchRepoTree(
  installationId: string,
  repoFullName: string,
  branch: string,
): Promise<Result<RepoTree>> {
  const result = await request<RawTree>(
    installationId,
    `/repos/${repoFullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );
  if (!result.ok) return result;

  // flatMap rather than filter+map so the narrowing survives: an entry without a
  // path or a sha is not a file we can record, and dropping it is the honest
  // answer — a row keyed on an empty sha would poison every later comparison.
  const entries = (result.data.tree ?? []).flatMap<RepoTreeEntry>((entry) =>
    entry.type === "blob" && entry.path && entry.sha
      ? [{ path: entry.path, sha: entry.sha, bytes: entry.size ?? 0 }]
      : [],
  );

  return {
    ok: true,
    data: { sha: result.data.sha, entries, truncated: Boolean(result.data.truncated) },
  };
}

interface RawContributor {
  login?: string;
  avatar_url?: string;
  contributions?: number;
  type?: string;
}

export interface Contributor {
  login: string;
  avatarUrl: string;
  contributions: number;
}

/**
 * Everyone who has committed, most prolific first. Bots are dropped: they push
 * constantly and would otherwise dominate a roster meant for people.
 */
export async function fetchContributors(
  installationId: string,
  repoFullName: string,
): Promise<Result<Contributor[]>> {
  const result = await request<RawContributor[]>(
    installationId,
    `/repos/${repoFullName}/contributors?per_page=100`,
  );
  if (!result.ok) return result;

  return {
    ok: true,
    data: result.data
      .filter((raw) => raw.login && raw.type !== "Bot" && !raw.login.endsWith("[bot]"))
      .map((raw) => ({
        login: raw.login ?? "",
        avatarUrl: raw.avatar_url ?? "",
        contributions: raw.contributions ?? 0,
      })),
  };
}
