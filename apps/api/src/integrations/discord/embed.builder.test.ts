/**
 * The embed's footer tells the channel when a report is the second one about a
 * push: a rewrite asked for after the first was sent (0012). Without it, two
 * messages about one push read as two pushes.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { NormalizedPush } from "@commander/shared";
import { buildEmbed } from "@/integrations/discord/embed.builder.js";

const PUSH: NormalizedPush = {
  repoFullName: "team/repo",
  repoUrl: "",
  branch: "main",
  ref: "refs/heads/main",
  forced: false,
  created: false,
  deleted: false,
  compareUrl: "",
  actorLogin: "sara",
  actorAvatarUrl: "",
  commits: [],
  truncated: false,
};

const embed = (rewrite?: boolean) =>
  buildEmbed({ locale: "ar", push: PUSH, displayName: "سارة", rank: "", violations: [], commendations: [], reportText: "تقرير", ...(rewrite !== undefined && { rewrite }) });

test("a rewrite says so in its footer, and a first report does not", () => {
  assert.match(embed(true).footer.text, /إعادة كتابة لتقرير سابق/);
  assert.doesNotMatch(embed(false).footer.text, /إعادة كتابة/);
  assert.doesNotMatch(embed().footer.text, /إعادة كتابة/);
});
