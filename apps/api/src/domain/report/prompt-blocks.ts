/**
 * Facts rendered as the text blocks the model reads. Split from prompt-builder,
 * which decides *which* values the prompt carries; this decides how each one
 * reads. Pure (§2) — every input arrives as an argument.
 *
 * Everything that originated outside this system — a commit title, a reviewer's
 * remark — passes through the quote guard here, so no caller can forget it.
 */

import {
  isCheckMetric,
  readInPart,
  t,
  type Commendation,
  type LocaleId,
  type NormalizedCommit,
  type NormalizedPush,
  type ReviewVerdict,
  type StructureDigest,
  type ViolationHit,
} from "@commander/shared";
import type { PushKind } from "@/domain/judgement/event.js";
import { sanitizeQuote } from "./sanitize.js";

export interface Quote {
  maxLength: number;
  guardEnabled: boolean;
}

/** One reviewed commit, as the communiqué is allowed to cite it. */
export interface ReviewedCommit {
  title: string;
  verdict: ReviewVerdict;
  remark: string;
  findings: string[];
}

/**
 * A charge as a sentence.
 *
 * A check on a file that did not exist before carries no `before`, and takes a
 * sentence that does not claim one. The alternative was interpolating a zero,
 * which reads as "it measured zero lines" — a number nobody took, asserted in
 * the one place the system is supposed to be provable.
 */
export function violationLabel(locale: LocaleId, hit: ViolationHit): string {
  const created = isCheckMetric(hit.ruleId) && hit.detail["before"] === undefined;
  return t(locale, `rule.${hit.ruleId}.${created ? "reportNew" : "report"}`, hit.detail);
}

/** A credit as a sentence. Only checks can earn one — an engagement rule has no
 *  "back under", so there is no `rule.<RuleId>.praise` to reach. */
export function praiseLabel(locale: LocaleId, entry: Commendation): string {
  return t(locale, `rule.${entry.ruleId}.praise`, entry.detail);
}

/**
 * What happened, as a sentence for the model (0009 §2): a landing is named as
 * one, so it is not described as a heap of commits — and an event that could
 * not be told is said to be unknown rather than left to be guessed.
 */
export function eventLine(locale: LocaleId, event: { kind: PushKind; pull: number | null }): string {
  return t(locale, `event.${event.kind}`, { number: event.pull ?? "" });
}

/**
 * A charge that names whose it is when it is not the addressee's. The
 * communiqué speaks to one member, and a charge listed without a name reads as
 * theirs: the model would scold whoever pushed for a commit someone else wrote.
 */
export function chargeLabel(locale: LocaleId, hit: ViolationHit, addressee: string): string {
  const label = violationLabel(locale, hit);
  return hit.login === addressee ? label : t(locale, "report.chargedTo", { label, login: hit.login });
}

/** A credit, named the same way — praise read as the addressee's is praise stolen from its author. */
export function creditLabel(locale: LocaleId, entry: Commendation, addressee: string): string {
  const label = praiseLabel(locale, entry);
  return entry.login === addressee ? label : t(locale, "report.creditedTo", { label, login: entry.login });
}

/**
 * One commit as the model sees it. Files and lines are stated as distinct
 * quantities — the old single triplet was read as line counts and turned an
 * unenriched push into "صفر أسطر مضافة". When enrichment has not run, the line
 * clause is omitted entirely rather than sent as a zero we never measured.
 */
function commitLine(locale: LocaleId, commit: NormalizedCommit, quote: Quote): string {
  const values = {
    title: sanitizeQuote(commit.title, quote),
    files: commit.filesAdded + commit.filesRemoved + commit.filesModified,
  };

  if (commit.additions === undefined && commit.deletions === undefined) {
    return t(locale, "report.commitLine", values);
  }

  return t(locale, "report.commitLineDetailed", {
    ...values,
    plus: commit.additions ?? 0,
    minus: commit.deletions ?? 0,
  });
}

export function buildCommitBlock(push: NormalizedPush, locale: LocaleId, quote: Quote): string {
  const lines = push.commits.map((commit) => commitLine(locale, commit, quote)).join("\n");
  if (!lines) return t(locale, "report.noViolations");
  const notes = [push.truncated && "report.truncated", readInPart(push) && "report.unmeasured"] as const;
  return [lines, ...notes.filter((key) => key !== false).map((key) => t(locale, key))].join("\n");
}

export function buildViolationBlock(violations: ViolationHit[], locale: LocaleId, addressee: string): string {
  if (violations.length === 0) return t(locale, "report.noViolations");
  return violations.map((hit) => `- ${chargeLabel(locale, hit, addressee)}`).join("\n");
}

/**
 * What this push earned, headed by its own line.
 *
 * Empty when nothing was earned — not "no improvements this time". A model told
 * every push that nobody improved anything learns that improvement is the
 * exception worth remarking on; told nothing, it simply has nothing to say.
 */
export function buildCommendationBlock(entries: Commendation[], locale: LocaleId, addressee: string): string {
  if (entries.length === 0) return "";

  const lines = entries.map((entry) => `- ${creditLabel(locale, entry, addressee)}`).join("\n");
  return `${t(locale, "report.commendationsHeading")}\n${lines}`;
}

/**
 * The code verdicts, so the communiqué can praise or condemn what is actually in
 * the diff instead of guessing from a commit title.
 */
export function buildReviewBlock(
  reviews: ReviewedCommit[],
  locale: LocaleId,
  quote: Quote,
): string {
  if (reviews.length === 0) return t(locale, "report.noReviews");

  return reviews
    .map((review) => {
      const head = t(locale, "report.reviewLine", {
        title: sanitizeQuote(review.title, quote),
        verdict: t(locale, `review.verdict.${review.verdict}`),
        remark: sanitizeQuote(review.remark, quote),
      });

      const findings = review.findings.map((finding) =>
        t(locale, "report.reviewFinding", { finding: sanitizeQuote(finding, quote) }),
      );

      return [head, ...findings].join("\n");
    })
    .join("\n");
}

/**
 * The project's layout, so the reporter can judge *where* a file landed and not
 * only what it contains. Rendered as counts rather than a path listing: the
 * shape is the useful part, and a full tree would crowd out the diff.
 */
export function buildStructureBlock(
  structure: StructureDigest | null,
  locale: LocaleId,
): string {
  if (!structure) return t(locale, "report.noStructure");

  const areas = structure.areas
    .map((area) => t(locale, "report.structureArea", { path: area.path, files: area.files }))
    .join(t(locale, "report.listSeparator"));

  const head = t(locale, "report.structureHead", {
    files: structure.totalFiles,
    markers: structure.markers.join(", ") || t(locale, "state.none"),
    types: structure.extensions.map((entry) => entry.ext).join(", ") || t(locale, "state.none"),
  });

  // A capped listing must say so, or its counts read as a complete inventory.
  return structure.truncated ? `${head}\n${areas}\n${t(locale, "report.structureTruncated")}` : `${head}\n${areas}`;
}

export function buildHistoryBlock(counts: Record<string, number>, locale: LocaleId): string {
  const entries = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([ruleId, count]) =>
      t(locale, "report.historyLine", { label: t(locale, `rule.${ruleId}.label`), count }),
    );

  return entries.join(t(locale, "report.listSeparator")) || t(locale, "report.cleanRecord");
}
