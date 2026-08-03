/**
 * Can we read this repository, and if not, which of the reasons is it?
 *
 * Separate from `github.client.ts` because the question is different in kind:
 * that file fetches data and degrades quietly when it cannot, which is right for
 * enrichment — a missing line count must never cost a report. This one exists to
 * *not* degrade quietly. It is asked once, before a scan does any work, because
 * afterwards the reason is gone: every step downstream is best-effort and throws
 * nothing away more thoroughly than a failure it was designed to absorb.
 */

import { SCAN_BLOCKERS, type ScanBlocker } from "@commander/shared";
import { getInstallationToken } from "./app-auth.js";
import { request } from "./github.client.js";

const isBlocker = (value: string): value is ScanBlocker =>
  (SCAN_BLOCKERS as readonly string[]).includes(value);

/** @returns the blocker, or null when the repository is readable. */
export async function probeAccess(
  installationId: string,
  repoFullName: string,
): Promise<ScanBlocker | null> {
  const auth = await getInstallationToken(installationId);
  if (!auth.ok) return auth.blocker;

  const result = await request<{ id: number }>(installationId, `/repos/${repoFullName}`);
  if (result.ok) return null;

  // A token that works against a repository that 404s means the App is installed
  // on the account but not on this repository — the likeliest cause with a
  // private repo, and the one least guessable from silence. 403 is the same
  // situation reported differently depending on the account's settings.
  if (result.notFound || result.error === "http_403") return "repoNotInInstallation";

  return isBlocker(result.error) ? result.error : "githubRefused";
}
