/**
 * Turns a normalized push into a report and an embed. Shared by the queue
 * processor and the panel's preview, so what you preview is what gets sent.
 */

import {
  DEFAULT_GRAVITY,
  weighPush,
  type Commendation,
  type NormalizedPush,
  type Repository,
  type Settings,
  type StructureDigest,
  type ViolationHit,
  type Watcher,
} from "@commander/shared";
import { createLogger } from "@/core/logger/logger.js";
import { answered, judgeRules } from "@/domain/judgement/attribution.js";
import { classifyPush, type PushKind } from "@/domain/judgement/event.js";
import type { RuleErrorReporter } from "@/domain/violations/engine.js";
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
import { llmOutcome, withRewrite } from "@/domain/report/generation.js";

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
  llmRetryAfterSeconds: number | null;
  llmFailure: Record<string, string | number> | null;
  /** True for the digest, which goes out on its facts when the prose fails (`afterGeneration`). */
  proseOptional?: boolean;
  model: string;
}

/** The domain layer stays pure; logging a rule that threw is the caller's job (§6). */
export const logRuleError: RuleErrorReporter = (ruleId, error) =>
  log.error("rule threw", { ruleId, error: String(error) });

/**
 * The rules alone, for the preview, each charge naming who answers for it. The
 * worker's charges come from `judgePush`, which evaluates the same rules on a
 * push weighed against the real history.
 */
export function detectViolations(input: { push: NormalizedPush; repository: Repository; settings: Settings }): ViolationHit[] {
  const { push, repository, settings } = input;
  const weight = weighPush({ push, knownShas: EMPTY_HISTORY });
  // Someone's own commits, so no button landed them; on the main line, so every
  // rule the sample was written to exercise runs; and no checks, so it lands nothing.
  const kind = classifyPush({ push, pull: { status: "unasked" } });
  const facts = { push, kind, trunk: true, weight, knownShas: EMPTY_HISTORY, rules: repository.rules, timezoneOffset: settings.timezoneOffset, landed: [] };
  return answered(judgeRules(facts, logRuleError));
}

/** A push weighed against no history: every commit is new, which is what a
 *  preview of a sample push means. */
const EMPTY_HISTORY: ReadonlySet<string> = new Set();

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
  /** What happened (`judgePush`), so a landing is not described as a heap of commits. */
  event: { kind: PushKind; pull: number | null };
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
  /** The text this report rewrites, when it is asked for again after being sent (0012). */
  rewrites?: string | null;
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
    event: input.event,
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
  const rendered = renderPrompts(input, member, { constitution, structure });
  const { values, systemPrompt } = rendered;
  const userPrompt = withRewrite(rendered.userPrompt, { locale, previous: input.rewrites ?? null });

  const completion = await requestCompletion({
    // Branch, then repository, then the global default. A sensitive branch may
    // name its own model, but every branch is read at the same depth.
    model: input.watcher?.model || repository.model || settings.model,
    systemPrompt,
    userPrompt,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  });

  // The preview shows this sentence when the model fails; the worker never
  // sends it — a failed report is retried or held (`afterGeneration`, 0012).
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
      rewrite: Boolean(input.rewrites),
    }),
    ...llmOutcome(completion),
    model: completion.model,
  };
}

export { noViolationsLabel, samplePush } from "./sample-push.js";
