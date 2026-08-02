import { isGitHubUiCommit, isMergeCommit, type RuleConfigBase } from "@commander/shared";
import type { RuleEvaluator } from "../types.js";

/**
 * Fires only when real local commits landed without passing through GitHub.
 *
 * The naive implementation matches a "Merge ..." message prefix, which is only
 * produced by the merge-commit strategy. Squash and rebase merges produce
 * ordinary-looking commits, so that version flags nearly every push as a PR
 * bypass and the reports become noise. Committer identity is the reliable
 * signal — see isGitHubUiCommit.
 */
export const directPushRule: RuleEvaluator<RuleConfigBase> = ({ push }) => {
  if (push.commits.length === 0) return null;

  const arrivedViaGitHub = push.commits.some(
    (commit) => isGitHubUiCommit(commit) || isMergeCommit(commit),
  );

  return arrivedViaGitHub ? null : { count: push.commits.length };
};
