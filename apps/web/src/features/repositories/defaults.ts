import { DEFAULT_SCHEDULE, defaultRuleConfig, type RepositoryInput } from "@commander/shared";

/**
 * The starting point for a newly added repository.
 *
 * The defaults are opinionated on purpose: a repo added to the panel is usually
 * one being set up, and `main` is worth guarding from the first push rather than
 * after the first accident. Every value here is one edit away in the card.
 */
export function blankRepository(): RepositoryInput {
  return {
    fullName: "owner/repo",
    enabled: true,
    branches: ["main"],
    discordWebhookUrl: "",
    model: "",
    promptId: null,
    silentWhenClean: false,
    projectBrief: "",
    projectStage: "bootstrap",
    // Ordered: main claims critical before the catch-all takes the rest.
    watchers: [
      { pattern: "main", gravity: "critical", promptId: null, model: "" },
      { pattern: "*", gravity: "routine", promptId: null, model: "" },
    ],
    githubInstallationId: "",
    rules: defaultRuleConfig(),
    // The shipped rhythm, stated rather than left absent: a new front should show
    // the operator when its first harvest lands, not an empty box.
    schedules: { weekly_digest: DEFAULT_SCHEDULE },
  // Nothing overridden and no template: a new front starts on the shipped limits.
  checkTemplateId: null,
  checks: {},
    members: [],
  };
}
