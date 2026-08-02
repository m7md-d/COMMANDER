/**
 * A project's lifecycle stage — the adapter that lets one platform judge a repo
 * on its first day and a repo in its tenth year by the same engine.
 *
 * Stage decides what counts as *expected*. Scaffolding, a licence and a config
 * file are the whole job during bootstrap and worth commending; the same commits
 * against a frozen codebase are worth a question. Without this the model has one
 * register — mockery — and applies it to a project doing exactly what it should.
 *
 * The ids are persisted, so renaming one is a migration, not a refactor. The
 * label and the guidance the model reads are i18n keys (`stage.<id>.*`) because
 * they follow the report locale like every other prompt string.
 */

export const PROJECT_STAGES = ["bootstrap", "active", "hardening", "frozen"] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number];

/** What a repository is assumed to be until its operator says otherwise. */
export const DEFAULT_PROJECT_STAGE: ProjectStage = "active";
