/**
 * Gives a push its real file and line counts before the rules and the report
 * read it.
 *
 * The webhook payload carries file *paths* but no line counts, and the commits
 * list the reconciler uses carries neither — so a recovered push arrives as all
 * zeroes. Two things then go wrong: the communiqué states that nothing changed,
 * and every rule that counts files (large_diff, batch size) silently under-fires.
 * One API call per commit, before either consumer runs, closes both.
 *
 * Best-effort (§6): with no App, or on any API failure, the push is returned
 * untouched and the report omits line counts rather than inventing them.
 *
 * This file is the wiring — the App check, the network, the log line. What the
 * details *do* to a push lives in `push.detail.ts`, where it can be tested
 * against real repositories without either.
 */

import { isGitHubUiCommit, type NormalizedPush } from "@commander/shared";
import { createLogger } from "@/core/logger/logger.js";
import { headOf, pullFact, type PullFact } from "@/domain/judgement/event.js";
import { isGitHubAppConfigured } from "@/integrations/github/app-auth.js";
import { fetchCommitPulls, listClosedPulls } from "@/integrations/github/pulls.client.js";
import { fetchCommitDetail } from "@/integrations/github/github.client.js";
import { enrichWith } from "./push.detail.js";

const log = createLogger("push-enrich");

export async function enrichPush(
  repository: { fullName: string; githubInstallationId: string },
  push: NormalizedPush,
): Promise<NormalizedPush> {
  if (!isGitHubAppConfigured() || !repository.githubInstallationId) return push;

  const result = await enrichWith(push, (sha) =>
    fetchCommitDetail(repository.githubInstallationId, repository.fullName, sha),
  );

  if (result.enriched > 0) {
    log.info("push enriched", { repo: repository.fullName, enriched: result.enriched });
  }
  return result.push;
}

/**
 * Whether a pull request landed the push (0009 §2). Asked only when GitHub
 * itself committed the head — every merge button commits as `web-flow` — and
 * only with the App. Anything else is not a landing, and a refusal is
 * `unknown`: the push's event then cannot be told, and nothing weighs it.
 *
 * The commit's own list names a merged pull request only on the default branch.
 * Elsewhere a squash would read as the pencil — a direct push charged to
 * whoever merged — so the branch's recently closed pull requests are asked too
 * (scenario `squash-merged-into-a-release-branch`).
 */
export async function readPull(
  repository: { fullName: string; githubInstallationId: string },
  push: NormalizedPush,
): Promise<PullFact> {
  const head = headOf(push);
  if (!head || !isGitHubUiCommit(head)) return { status: "unasked" };
  if (!isGitHubAppConfigured() || !repository.githubInstallationId) return { status: "unknown" };

  const ask = { installationId: repository.githubInstallationId, repo: repository.fullName };
  const own = await fetchCommitPulls(ask.installationId, ask.repo, head.sha);
  const found = own.ok ? pullFact(own.data, head.sha) : null;
  if (found?.status !== "none" || push.branch === push.defaultBranch) return found ?? unanswered(repository, own);

  const closed = await listClosedPulls(ask.installationId, ask.repo, push.branch);
  if (!closed.ok) return unanswered(repository, closed);
  // A full page with no landing in it may have cut the landing off: unknown, never "none".
  const landed = pullFact(closed.data.pulls, head.sha);
  return landed.status === "landed" || closed.data.complete ? landed : { status: "unknown" };
}

function unanswered(repository: { fullName: string }, failed: { ok: false; error: string } | { ok: true }): PullFact {
  if (!failed.ok) log.warn("pull requests unreadable", { repo: repository.fullName, error: failed.error });
  return { status: "unknown" };
}
