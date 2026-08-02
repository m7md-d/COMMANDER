/**
 * Turns a push plus its history into the two prompt strings. Pure (§2): every
 * input arrives as an argument, and the only outputs are strings.
 */

import {
  computeTone,
  t,
  type Commendation,
  type LocaleId,
  type NormalizedPush,
  type Gravity,
  type ProjectStage,
  type StructureDigest,
  type PromptValues,
  type ViolationHit,
} from "@commander/shared";
import { sanitizeQuote } from "./sanitize.js";
import {
  buildCommendationBlock,
  buildCommitBlock,
  buildHistoryBlock,
  buildReviewBlock,
  buildStructureBlock,
  buildViolationBlock,
  type Quote,
  type ReviewedCommit,
} from "./prompt-blocks.js";

export { praiseLabel, violationLabel, type ReviewedCommit } from "./prompt-blocks.js";

export interface MemberIdentity {
  displayName: string;
  rank: string;
  note: string;
}

export interface HistoryRecord {
  totalCommits: number;
  totalPushes: number;
  violationCounts: Record<string, number>;
}

export interface BuildOptions {
  locale: LocaleId;
  maxWords: number;
  quoteMaxLength: number;
  injectionGuard: boolean;
  /** Now, and the hours to shift it by, so the model stops inventing a date. */
  now: Date;
  timezoneOffset: number;
}

/** What the repository is and where it is in its life (see ProjectStage). */
export interface ProjectProfile {
  brief: string;
  stage: ProjectStage;
  /** The repo's own rules document, or null when it has none. */
  constitution: string | null;
  /** Cached layout from the last scan, or null before one has run. */
  structure: StructureDigest | null;
}

/**
 * The rules document is quoted, not obeyed, so it is clamped hard: it competes
 * with the diff for the same context window, and a repo could otherwise hand the
 * model a 40k-character instruction sheet.
 */
const CONSTITUTION_LIMIT = 2_000;

export function buildPromptValues(input: {
  push: NormalizedPush;
  member: MemberIdentity | null;
  violations: ViolationHit[];
  commendations: Commendation[];
  history: HistoryRecord;
  options: BuildOptions;
  project: ProjectProfile;
  reviews: ReviewedCommit[];
  gravity: Gravity;
}): PromptValues {
  const { push, member, violations, history, options, project, reviews, gravity } = input;
  const { locale } = options;
  const quote = { maxLength: options.quoteMaxLength, guardEnabled: options.injectionGuard };

  const tone = computeTone({
    violations: violations.map((hit) => hit.ruleId),
    lifetimeCounts: history.violationCounts,
    stage: project.stage,
    gravity,
  });

  return {
    tone: t(locale, `tone.${tone.level}.guidance`, { repeats: tone.repeats }),
    branchGravity: t(locale, `gravity.${gravity}.guidance`, { branch: push.branch }),
    codeReview: buildReviewBlock(reviews, locale, quote),
    today: localDate(options.now, options.timezoneOffset),
    ...projectValues(project, locale, quote),
    ...identityValues({ push, member, locale, quote }),
    branch: push.branch,
    commitCount: push.commits.length,
    commits: buildCommitBlock(push, locale, quote),
    violations: buildViolationBlock(violations, locale),
    commendations: buildCommendationBlock(input.commendations, locale),
    history: buildHistoryBlock(history.violationCounts, locale),
    totalCommits: history.totalCommits,
    totalPushes: history.totalPushes,
    maxWords: options.maxWords,
  };
}

/** What the project is and expects. Repo-authored text passes the quote guard,
 *  because a CONSTITUTION.md carries an instruction as easily as a commit does. */
function projectValues(project: ProjectProfile, locale: LocaleId, quote: Quote) {
  return {
    projectBrief:
      sanitizeQuote(project.brief, { ...quote, maxLength: 400 }) || t(locale, "stage.none"),
    projectStage: t(locale, `stage.${project.stage}.label`),
    stageGuidance: t(locale, `stage.${project.stage}.guidance`),
    constitution: project.constitution
      ? sanitizeQuote(project.constitution, { ...quote, maxLength: CONSTITUTION_LIMIT })
      : t(locale, "report.noConstitution"),
    structure: buildStructureBlock(project.structure, locale),
  };
}

/** Who the communiqué is addressed to. Falls back to the login when the member
 *  is not on the roster, so an unregistered pusher is still named. */
function identityValues(input: {
  push: NormalizedPush;
  member: MemberIdentity | null;
  locale: LocaleId;
  quote: Quote;
}) {
  const { push, member, locale, quote } = input;
  const rank = member?.rank ?? "";

  return {
    repo: push.repoFullName,
    displayName: member?.displayName || push.actorLogin,
    rank,
    rankSuffix: rank ? `${t(locale, "report.rankSeparator")}${rank}` : "",
    login: push.actorLogin,
    note: sanitizeQuote(member?.note ?? "", { ...quote, maxLength: 300 }),
  };
}

/**
 * The operator's local calendar date as YYYY-MM-DD. Absent this the model dates
 * the communiqué by guesswork — it stamped one "٤/٢٠٢٤" two years out. Shifting
 * the epoch and reading UTC fields keeps the arithmetic independent of the
 * server's own zone.
 */
function localDate(now: Date, timezoneOffset: number): string {
  const shifted = new Date(now.getTime() + timezoneOffset * 3_600_000);
  return shifted.toISOString().slice(0, 10);
}
