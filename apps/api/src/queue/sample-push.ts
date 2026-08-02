/**
 * The fabricated push behind the panel's preview and its test-send button.
 *
 * Kept out of report.pipeline because it is fixture data, not pipeline logic:
 * the pipeline must not grow a second reason to change. It is deliberately a
 * *bad* push — forced, at night, one lazy message and one oversized commit — so
 * a preview exercises the rules rather than showing a blank clean report.
 */

import { t, type NormalizedPush, type Settings } from "@commander/shared";

export function samplePush(repoFullName: string, login: string): NormalizedPush {
  const nightly = new Date();
  nightly.setUTCHours(23, 14, 0, 0);
  const stamp = nightly.toISOString();

  const commit = (sha: string, title: string, modified: number) => ({
    sha,
    title,
    url: "",
    timestamp: stamp,
    filesAdded: 1,
    filesRemoved: 0,
    filesModified: modified,
    authorLogin: login,
    committerLogin: login,
  });

  return {
    repoFullName,
    repoUrl: `https://github.com/${repoFullName}`,
    branch: "main",
    ref: "refs/heads/main",
    forced: true,
    created: false,
    deleted: false,
    compareUrl: `https://github.com/${repoFullName}/compare/aaaaaaa...bbbbbbb`,
    actorLogin: login,
    actorAvatarUrl: "",
    truncated: false,
    commits: [commit("aaaaaaa", "wip", 3), commit("bbbbbbb", "fix everything hopefully", 40)],
  };
}

export function noViolationsLabel(locale: Settings["reportLocale"]): string {
  return t(locale, "report.noViolations");
}
