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

import type { CommitDetail } from "./github.client.js";
import type { CommitListEntry } from "./commits.client.js";

/** `GET /repos/{owner}/{repo}/commits/{ref}`, the fields read from it. */
export interface RawCommit {
  sha: string;
  parents?: { sha?: string }[];
  stats?: { additions?: number; deletions?: number };
  files?: {
    filename: string;
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

export function toCommitDetail(raw: RawCommit): CommitDetail {
  return {
    sha: raw.sha,
    parents: (raw.parents ?? []).map((parent) => parent.sha ?? "").filter(Boolean),
    additions: raw.stats?.additions ?? 0,
    deletions: raw.stats?.deletions ?? 0,
    files: (raw.files ?? []).map((file) => ({
      path: file.filename,
      additions: file.additions ?? 0,
      deletions: file.deletions ?? 0,
      status: file.status ?? "modified",
      ...(file.patch !== undefined && { patch: file.patch }),
      ...(file.previous_filename !== undefined && { previousPath: file.previous_filename }),
    })),
  };
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
