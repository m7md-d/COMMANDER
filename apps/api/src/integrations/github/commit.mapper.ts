/**
 * GitHub's commit JSON, read into the shapes the pipeline uses.
 *
 * Split from the clients for the reason `openrouter.usage.ts` was split from its
 * own: this is a pure reading of an untrusted shape, and a client cannot be
 * imported without booting the validated environment. The scenario reference
 * (`src/scenarios/`) hands these functions the JSON a real repository produces,
 * so a change to how a field is read shows up there the moment it is made —
 * which is the only way a field being *dropped* is ever noticed.
 */

import type { CommitPull } from "@/domain/judgement/event.js";
import type { CommitDetail, CommitFileChange } from "./github.client.js";
import type { CommitListEntry } from "./commits.client.js";

/** `GET /repos/{owner}/{repo}/commits/{ref}`, the fields read from it. */
export interface RawCommit {
  sha: string;
  parents?: { sha?: string }[];
  stats?: { additions?: number; deletions?: number };
  files?: {
    filename: string;
    /** The file's blob after the commit. */
    sha?: string;
    additions?: number;
    deletions?: number;
    status?: string;
    patch?: string;
    previous_filename?: string;
  }[];
}

/** One entry of `GET /repos/{owner}/{repo}/commits`, the fields read from it. */
export interface RawListCommit {
  sha: string;
  html_url?: string;
  commit?: { message?: string; author?: { date?: string }; committer?: { date?: string } };
  author?: { login?: string } | null;
  committer?: { login?: string } | null;
}

/**
 * GitHub lists at most 3,000 of a commit's files ("Get a commit": past 300, the
 * rest come in pages announced by a `Link` header, up to 3,000). A listing that
 * long may have stopped short, and nothing in it says whether it did.
 */
export const COMMIT_FILES_CAP = 3000;
export const COMMIT_FILES_PAGE = 300;

/** A commit read from its first page and every page after it, in order. */
export function toCommitDetail(raw: RawCommit, more: RawCommit[] = []): CommitDetail {
  const files = [raw, ...more].flatMap((page) => (page.files ?? []).map(toFileChange));
  return {
    sha: raw.sha,
    parents: (raw.parents ?? []).map((parent) => parent.sha ?? "").filter(Boolean),
    additions: raw.stats?.additions ?? 0,
    deletions: raw.stats?.deletions ?? 0,
    files,
    complete: files.length < COMMIT_FILES_CAP,
  };
}

function toFileChange(file: NonNullable<RawCommit["files"]>[number]): CommitFileChange {
  return {
    path: file.filename,
    additions: file.additions ?? 0,
    deletions: file.deletions ?? 0,
    status: file.status ?? "modified",
    ...(file.sha !== undefined && { sha: file.sha }),
    ...(file.patch !== undefined && { patch: file.patch }),
    ...(file.previous_filename !== undefined && { previousPath: file.previous_filename }),
  };
}

/** `GET /repos/{owner}/{repo}/compare/{base}...{head}`, the files read from it. */
export interface RawCompareFiles {
  files?: RawCommit["files"];
}

/** GitHub's compare lists at most 300 files ("Compare two commits"), and says nothing when it stops. */
export const COMPARE_FILES_CAP = 300;

/**
 * Two commits' net difference, read as one commit's detail: what a push changed
 * between its ends, which the code review reads (0009 §7). Its lines are the
 * files' sums — the compare carries no totals of its own.
 */
export function toCompareDetail(raw: RawCompareFiles, head: string): CommitDetail {
  const files = (raw.files ?? []).map(toFileChange);
  const sum = (pick: (file: CommitFileChange) => number) => files.reduce((total, file) => total + pick(file), 0);
  return {
    sha: head,
    parents: [],
    additions: sum((file) => file.additions),
    deletions: sum((file) => file.deletions),
    files,
    complete: files.length < COMPARE_FILES_CAP,
  };
}

const API_ORIGIN = "https://api.github.com";

/**
 * The page a `Link` header names as next, as a path on GitHub's API — or null.
 * Only a link on the API itself is followed: the installation token goes with
 * every request, and a header is not a place to learn where to send it.
 */
export function nextPage(link: string | null): string | null {
  const next = link?.split(",").find((part) => /;\s*rel="next"/.test(part));
  const url = next?.match(/<([^>]+)>/)?.[1];
  return url?.startsWith(`${API_ORIGIN}/`) ? url.slice(API_ORIGIN.length) : null;
}

export function toCommitListEntry(raw: RawListCommit): CommitListEntry {
  const message = String(raw.commit?.message ?? "");
  return {
    sha: raw.sha,
    url: raw.html_url ?? "",
    title: message.split("\n")[0]?.trim() ?? "",
    timestamp: raw.commit?.committer?.date ?? raw.commit?.author?.date ?? "",
    authorLogin: raw.author?.login ?? "",
    committerLogin: raw.committer?.login ?? "",
  };
}

/** One entry of `GET /repos/{owner}/{repo}/commits/{sha}/pulls`, the fields read from it. */
export interface RawCommitPull {
  number?: number;
  merged_at?: string | null;
  merge_commit_sha?: string | null;
  head?: { sha?: string };
}

export function toCommitPull(raw: RawCommitPull): CommitPull {
  return {
    number: raw.number ?? 0,
    merged: Boolean(raw.merged_at),
    mergeCommit: raw.merge_commit_sha || null,
    head: raw.head?.sha ?? "",
  };
}
