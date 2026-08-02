/**
 * GitHub REST calls the dossier depends on. Returns Results, never throws (§6):
 * enrichment is an enhancement, and its failure must never lose a report.
 */

import { createLogger } from "@/core/logger/logger.js";
import { getInstallationToken } from "./app-auth.js";

const log = createLogger("github");
const API = "https://api.github.com";
const TIMEOUT_MS = 20_000;

export interface CommitFileChange {
  path: string;
  additions: number;
  deletions: number;
  status: string;
  /** The unified diff for this file. Absent for binary or very large files. */
  patch?: string;
}

export interface CommitDetail {
  sha: string;
  additions: number;
  deletions: number;
  files: CommitFileChange[];
}

export interface RepoFile {
  path: string;
  sha: string;
  content: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; notFound: boolean };

/** The shared authenticated GET. Exported so sibling clients (commits.client)
 *  reuse the same token handling, timeout and 404-is-not-an-error contract. */
export async function request<T>(
  installationId: string,
  path: string,
): Promise<Result<T>> {
  const token = await getInstallationToken(installationId);
  if (!token) return { ok: false, error: "no_installation_token", notFound: false };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API}${path}`, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      // 404 is meaningful, not exceptional: a repo may simply have no
      // CONSTITUTION.md, and the caller should stop asking rather than retry.
      const notFound = response.status === 404;
      if (!notFound) log.warn("request failed", { path, status: response.status });
      return { ok: false, error: `http_${response.status}`, notFound };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return { ok: false, error: String(error), notFound: false };
  } finally {
    clearTimeout(timeout);
  }
}

interface RawCommit {
  sha: string;
  stats?: { additions?: number; deletions?: number };
  files?: {
    filename: string;
    additions?: number;
    deletions?: number;
    status?: string;
    patch?: string;
  }[];
}

/**
 * The push webhook carries file *paths* only. This is the call that turns them
 * into line counts, which is the whole basis of "who wrote how much of what".
 */
export async function fetchCommitDetail(
  installationId: string,
  repoFullName: string,
  sha: string,
): Promise<Result<CommitDetail>> {
  const result = await request<RawCommit>(installationId, `/repos/${repoFullName}/commits/${sha}`);
  if (!result.ok) return result;

  const raw = result.data;
  return {
    ok: true,
    data: {
      sha: raw.sha,
      additions: raw.stats?.additions ?? 0,
      deletions: raw.stats?.deletions ?? 0,
      files: (raw.files ?? []).map((file) => ({
        path: file.filename,
        additions: file.additions ?? 0,
        deletions: file.deletions ?? 0,
        status: file.status ?? "modified",
        ...(file.patch !== undefined && { patch: file.patch }),
      })),
    },
  };
}

interface RawContent {
  sha: string;
  content?: string;
  encoding?: string;
}

/**
 * A blob by its own hash, not by where it happens to sit.
 *
 * This is what makes measuring cost linear in *change* rather than in project
 * size: the same content under a new name is the same request we already made,
 * and a revert lands on a sha whose measurement is still on record. Asking by
 * path would re-fetch both.
 */
export async function fetchBlob(
  installationId: string,
  repoFullName: string,
  sha: string,
): Promise<Result<string>> {
  const result = await request<RawContent>(
    installationId,
    `/repos/${repoFullName}/git/blobs/${encodeURIComponent(sha)}`,
  );
  if (!result.ok) return result;

  const raw = result.data;
  // Anything not base64 is something we cannot count honestly, and an
  // unmeasured file is a better answer than a guessed one.
  if (raw.encoding !== "base64" || raw.content === undefined) {
    return { ok: false, error: "unsupported_encoding", notFound: false };
  }

  return { ok: true, data: Buffer.from(raw.content, "base64").toString("utf8") };
}

/**
 * Reads a file from the watched repository so the dossier can quote the
 * project's own rules rather than paraphrase them. The blob `sha` is returned
 * so the caller can skip re-storing unchanged content.
 */
export async function fetchRepoFile(
  installationId: string,
  repoFullName: string,
  path: string,
): Promise<Result<RepoFile>> {
  const result = await request<RawContent>(
    installationId,
    `/repos/${repoFullName}/contents/${encodeURIComponent(path)}`,
  );
  if (!result.ok) return result;

  const raw = result.data;
  if (raw.encoding !== "base64" || !raw.content) {
    return { ok: false, error: "unsupported_encoding", notFound: false };
  }

  return {
    ok: true,
    data: { path, sha: raw.sha, content: Buffer.from(raw.content, "base64").toString("utf8") },
  };
}
