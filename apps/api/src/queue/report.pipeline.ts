/**
 * Turns a normalized push into a report and an embed. Shared by the queue
 * processor and the panel's preview, so what you preview is what gets sent.
 */

import {
  DEFAULT_GRAVITY,
  type Commendation,
  type NormalizedPush,
  type Repository,
  type Settings,
  type StructureDigest,
  type ViolationHit,
  type Watcher,
} from "@commander/shared";
import { createLogger } from "@/core/logger/logger.js";
import { evaluateRules } from "@/domain/violations/engine.js";
import {
  buildPromptValues,
  type HistoryRecord,
  type MemberIdentity,
  type ReviewedCommit,
} from "@/domain/report/prompt-builder.js";
import {
  fallbackReport,
  renderTemplate,
  renderUserPrompt,
} from "@/domain/report/prompt-render.js";
import { requestCompletion } from "@/integrations/openrouter/openrouter.client.js";
import { readRepoConstitution } from "@/modules/dossier/enrichment.service.js";
import { readStructureDigest } from "@/modules/repositories/scan.service.js";
import { buildEmbed, type DiscordEmbed } from "@/integrations/discord/embed.builder.js";

const log = createLogger("pipeline");

export interface ComposedReport {
  violations: ViolationHit[];
  reportText: string;
  systemPrompt: string;
  userPrompt: string;
  embed: DiscordEmbed;
  llmOk: boolean;
  llmError: string | null;
  llmRetryable: boolean;
  model: string;
}

export function detectViolations(push: NormalizedPush, repository: Repository, settings: Settings) {
  return evaluateRules(
    { push, timezoneOffset: settings.timezoneOffset },
    repository.rules,
    // The domain layer stays pure; logging the failure is the caller's job (§6).
    (ruleId, error) => log.error("rule threw", { ruleId, error: String(error) }),
  );
}

export function findMember(repository: Repository, login: string): MemberIdentity | null {
  const member = repository.members.find(
    (candidate) => candidate.login.toLowerCase() === login.toLowerCase(),
  );
  return member
    ? { displayName: member.displayName, rank: member.rank, note: member.note }
    : null;
}

interface ComposeInput {
  push: NormalizedPush;
  repository: Repository;
  settings: Settings;
  violations: ViolationHit[];
  /** What this push earned. Empty in the preview, which judges a sample push
   *  against no stored tree — and inventing praise for a rehearsal would make
   *  the preview flatter the prompt being tested. */
  commendations: Commendation[];
  history: HistoryRecord;
  prompt: { system: string; user: string };
  /** Verdicts on this push's commits. Empty without the App — the block then
   *  says so rather than letting the model assume the code was fine. */
  reviews: ReviewedCommit[];
  /** The branch's watcher. Absent in the preview, which has no real branch. */
  watcher?: Watcher;
}

/** Turns the push and the member's history into the two rendered prompts. */
function renderPrompts(
  input: ComposeInput,
  member: MemberIdentity | null,
  cached: { constitution: string | null; structure: StructureDigest | null },
) {
  const { push, repository, settings, violations, history, prompt } = input;

  const values = buildPromptValues({
    push,
    member,
    violations,
    commendations: input.commendations,
    history,
    reviews: input.reviews,
    gravity: input.watcher?.gravity ?? DEFAULT_GRAVITY,
    project: {
      brief: repository.projectBrief,
      stage: repository.projectStage,
      constitution: cached.constitution,
      structure: cached.structure,
    },
    options: {
      locale: settings.reportLocale,
      maxWords: settings.maxWords,
      quoteMaxLength: settings.quoteMaxLength,
      injectionGuard: settings.injectionGuard,
      now: new Date(),
      timezoneOffset: settings.timezoneOffset,
    },
  });

  return {
    values,
    systemPrompt: renderTemplate(prompt.system, values),
    userPrompt: renderUserPrompt(prompt.user, values),
  };
}

export async function composeReport(input: ComposeInput): Promise<ComposedReport> {
  const { push, repository, settings, violations } = input;
  const locale = settings.reportLocale;

  const member = findMember(repository, push.actorLogin);
  // Best-effort: a repo with no rules document, or no App to read one, simply
  // reports that rather than blocking the communiqué.
  const [constitution, structure] = await Promise.all([
    readRepoConstitution(repository.id).catch(() => null),
    readStructureDigest(repository.id).catch(() => null),
  ]);
  const { values, systemPrompt, userPrompt } = renderPrompts(input, member, {
    constitution,
    structure,
  });

  const completion = await requestCompletion({
    // Branch, then repository, then the global default. A sensitive branch may
    // name its own model, but every branch is read at the same depth.
    model: input.watcher?.model || repository.model || settings.model,
    systemPrompt,
    userPrompt,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  });

  // A failed generation must never block the report: Discord still gets a
  // plain sentence, and the failure is recorded on the delivery row.
  const reportText = completion.ok ? completion.text : fallbackReport(locale, values);

  return {
    violations,
    reportText,
    systemPrompt,
    userPrompt,
    embed: buildEmbed({
      locale,
      push,
      displayName: member?.displayName || push.actorLogin,
      rank: member?.rank ?? "",
      violations,
      commendations: input.commendations,
      reportText,
    }),
    llmOk: completion.ok,
    llmError: completion.ok ? null : completion.error,
    llmRetryable: completion.ok ? false : completion.retryable,
    model: completion.model,
  };
}

export { noViolationsLabel, samplePush } from "./sample-push.js";
