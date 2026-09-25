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

import type { NormalizedPush } from "@commander/shared";
import { createLogger } from "@/core/logger/logger.js";
import { isGitHubAppConfigured } from "@/integrations/github/app-auth.js";
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
