/**
 * The only file that knows GitHub's payload field names. Everything downstream
 * consumes NormalizedPush, so a change on GitHub's side is contained here.
 */

import type { NormalizedCommit, NormalizedPush } from "@commander/shared";

/**
 * GitHub caps a push webhook's commits array at 2,048 ("a maximum of 2048
 * commits", push event docs). Twenty is the Events *timeline*'s cap, and read as
 * this one it marked every push of twenty commits or more truncated — neither
 * weighed nor measured (scenario `crossing-in-a-twenty-commit-push`).
 */
const COMMIT_ARRAY_CAP = 2048;

interface RawCommit {
  id?: string;
  distinct?: boolean;
  message?: string;
  url?: string;
  timestamp?: string;
  added?: unknown[];
  removed?: unknown[];
  modified?: unknown[];
  author?: { username?: string };
  committer?: { username?: string };
}

interface RawPushPayload {
  ref?: string;
  before?: string;
  after?: string;
  forced?: boolean;
  created?: boolean;
  deleted?: boolean;
  compare?: string;
  commits?: RawCommit[];
  repository?: { full_name?: string; html_url?: string; default_branch?: string };
  sender?: { login?: string; avatar_url?: string };
  pusher?: { name?: string };
}

function mapCommit(raw: RawCommit): NormalizedCommit {
  const message = String(raw.message ?? "");
  return {
    sha: raw.id ?? "",
    title: message.split("\n")[0]?.trim() ?? "",
    url: raw.url ?? "",
    timestamp: raw.timestamp ?? "",
    filesAdded: raw.added?.length ?? 0,
    filesRemoved: raw.removed?.length ?? 0,
    filesModified: raw.modified?.length ?? 0,
    authorLogin: raw.author?.username ?? "",
    committerLogin: raw.committer?.username ?? "",
    // Kept only when GitHub sent it: absent, the record decides what is new.
    ...(typeof raw.distinct === "boolean" && { distinct: raw.distinct }),
  };
}

export function normalizePush(payload: unknown): NormalizedPush {
  const raw = (payload ?? {}) as RawPushPayload;
  const commits = Array.isArray(raw.commits) ? raw.commits : [];
  const ref = raw.ref ?? "";

  return {
    repoFullName: raw.repository?.full_name ?? "",
    repoUrl: raw.repository?.html_url ?? "",
    branch: ref.replace(/^refs\/heads\//, ""),
    ref,
    forced: Boolean(raw.forced),
    created: Boolean(raw.created),
    deleted: Boolean(raw.deleted),
    compareUrl: raw.compare ?? "",
    ...(raw.before && { before: raw.before }),
    ...(raw.after && { after: raw.after }),
    ...(raw.repository?.default_branch && { defaultBranch: raw.repository.default_branch }),
    actorLogin: raw.sender?.login ?? raw.pusher?.name ?? "unknown",
    actorAvatarUrl: raw.sender?.avatar_url ?? "",
    commits: commits.map(mapCommit),
    truncated: commits.length >= COMMIT_ARRAY_CAP,
  };
}

export function isBranchRef(ref: string): boolean {
  return ref.startsWith("refs/heads/");
}
