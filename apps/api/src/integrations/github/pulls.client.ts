/**
 * Which pull request, if any, landed a commit — the question a push's event
 * turns on (0009 §2). Returns Results, never throws (§6): an unanswered question
 * leaves the event unknown, which weighs nothing and charges nobody.
 */

import type { CommitPull } from "@/domain/judgement/event.js";
import { request, type Result } from "./github.client.js";
import { toCommitPull, type RawCommitPull } from "./commit.mapper.js";

/**
 * The pull requests GitHub associates with a commit — for a commit on the
 * default branch, the merged one that introduced it; for any other, only the
 * open ones that hold it (GitHub docs, "List pull requests associated with a
 * commit"). Asked of a push's head to learn whether a button landed it.
 */
export async function fetchCommitPulls(installationId: string, repoFullName: string, sha: string): Promise<Result<CommitPull[]>> {
  const result = await request<RawCommitPull[]>(installationId, `/repos/${repoFullName}/commits/${sha}/pulls`);
  return result.ok ? { ok: true, data: result.data.map(toCommitPull) } : result;
}

const CLOSED_PAGE = 50;

/**
 * The pull requests most recently closed into `base`, newest activity first —
 * asked when the head is on a branch other than the default, where the commit's
 * own list shows no merged pull request at all. A landing into a release line
 * or a `develop` is found here, seconds after it merged. `complete` is false
 * when the page is full: a landing older than the page cannot be ruled out.
 */
export async function listClosedPulls(
  installationId: string,
  repoFullName: string,
  base: string,
): Promise<Result<{ pulls: CommitPull[]; complete: boolean }>> {
  const params = new URLSearchParams({ state: "closed", base, sort: "updated", direction: "desc", per_page: String(CLOSED_PAGE) });
  const result = await request<RawCommitPull[]>(installationId, `/repos/${repoFullName}/pulls?${params.toString()}`);
  if (!result.ok) return result;
  return { ok: true, data: { pulls: result.data.map(toCommitPull), complete: result.data.length < CLOSED_PAGE } };
}
