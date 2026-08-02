/**
 * The assessment as text the model reads — and the rules it writes under.
 *
 * The constraint that makes this worth having is not in the prose of the prompt,
 * it is here: **every fact the model may use is enumerated below, and a
 * suggestion that cannot cite one of them is not to be written.** A model given a
 * project name and asked what to improve produces advice that fits any
 * repository ever written; a model given "tree.service.ts is 194 lines against a
 * limit of 200, and this FIXME about the retry path has been here 41 days" can
 * only say something about this project.
 *
 * Everything the repository authored — a note's text, a reviewer's finding, the
 * rules document — is untrusted and passes the quote guard, exactly as a commit
 * message does.
 */

import { t, type LocaleId } from "@commander/shared";
import type { AssessmentFacts } from "@/modules/digest/assessment.read.js";
import { sanitizeQuote } from "@/domain/report/sanitize.js";

/** Three. A weekly report that opens ten work items is a backlog, and a backlog
 *  arriving by Discord is read once and never again. */
export const SUGGESTION_LIMIT = 3;

const QUOTE = { maxLength: 160, guardEnabled: true };

/** The repo's own rules, clamped: they compete with the evidence for the same
 *  context window, and a project could otherwise hand over a 40k instruction sheet. */
const CONSTITUTION_LIMIT = 1_500;

export function renderAssessment(locale: LocaleId, facts: AssessmentFacts): string {
  const blocks = [
    ...worstBlock(locale, facts),
    ...notesBlock(locale, facts),
    ...reviewBlock(locale, facts),
    ...rulesBlock(locale, facts),
  ];

  return blocks.length === 0 ? "" : blocks.join("\n");
}

function worstBlock(locale: LocaleId, facts: AssessmentFacts): string[] {
  if (facts.worst.length === 0) return [];

  return [
    t(locale, "assess.worst"),
    ...facts.worst.map((file) =>
      t(locale, file.baseline === null ? "assess.worstLine" : "assess.worstLineBaseline", {
        path: file.path,
        label: t(locale, `rule.${file.metric}.label`),
        value: file.value,
        threshold: file.threshold,
        baseline: file.baseline ?? 0,
      }),
    ),
  ];
}

function notesBlock(locale: LocaleId, facts: AssessmentFacts): string[] {
  const { notes } = facts;
  if (notes.total === 0) return [];

  const kinds = notes.byKind.map((entry) => `${entry.kind}:${entry.count}`).join(" ");
  return [
    t(locale, "assess.notes", { total: notes.total, kinds, added: notes.added }),
    ...notes.oldest.map((note) =>
      t(locale, "assess.noteLine", {
        kind: note.kind,
        path: note.path,
        line: note.line,
        days: note.ageDays,
        text: sanitizeQuote(note.text, QUOTE),
      }),
    ),
  ];
}

function reviewBlock(locale: LocaleId, facts: AssessmentFacts): string[] {
  const blocks: string[] = [];

  if (facts.verdicts.length > 0) {
    const summary = facts.verdicts
      .map((entry) => `${t(locale, `review.verdict.${entry.verdict}`)}:${entry.count}`)
      .join(" · ");
    blocks.push(t(locale, "assess.verdicts", { summary }));
  }

  if (facts.patterns.length > 0) {
    blocks.push(t(locale, "assess.patterns"));
    blocks.push(
      ...facts.patterns.map((pattern) =>
        t(locale, "assess.patternLine", {
          count: pattern.count,
          finding: sanitizeQuote(pattern.finding, QUOTE),
        }),
      ),
    );
  }

  return blocks;
}

function rulesBlock(locale: LocaleId, facts: AssessmentFacts): string[] {
  if (!facts.constitution) return [];

  return [
    t(locale, "assess.rules", {
      rules: sanitizeQuote(facts.constitution, { ...QUOTE, maxLength: CONSTITUTION_LIMIT }),
    }),
  ];
}
