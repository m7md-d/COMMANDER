/**
 * The evidence an assessment is allowed to rest on.
 *
 * Everything here is measured and already stored — nothing is asked of a model
 * until every number is in hand. That order is the whole difference between an
 * assessment and a horoscope: a model handed a project name and asked what to
 * improve will produce advice that fits any repository ever written, and a team
 * that reads three of those learns to skip the section.
 *
 * So the rule downstream is: a suggestion cites a path, a number or a note from
 * this file, or it is not written. This is where the citable facts come from.
 */

import { commitReviewSchema, type CheckMetric, type ReviewVerdict } from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { readNotes, type NoteIndex } from "@/modules/todos/todos.read.js";
import { readWorstFiles, type WorstFile } from "./worst.read.js";

/** How many commit reviews are read for the window. Enough to see a pattern,
 *  bounded so a busy week does not build a prompt nobody can afford. */
const REVIEWS = 40;

/** A finding repeated this often in one window is a pattern rather than a note
 *  about one commit — and only patterns are worth a line in a weekly report. */
const PATTERN_MIN = 2;

export interface ReviewPattern {
  finding: string;
  count: number;
}

export interface AssessmentFacts {
  notes: NoteIndex;
  /** The files furthest over their limits, with the numbers that prove it. */
  worst: WorstFile[];
  /** Verdict counts across the window's reviewed commits. */
  verdicts: { verdict: ReviewVerdict; count: number }[];
  /** Findings the reviewer raised more than once — the recurring shape of the
   *  week's mistakes, which no single commit's review can show. */
  patterns: ReviewPattern[];
  /** The repository's own rules document, or null when it has none. Quoted, not
   *  obeyed — see the prompt's untrusted-data wrapper. */
  constitution: string | null;
}

export async function readAssessment(input: {
  repositoryId: string;
  since: Date;
  until: Date;
  constitution: string | null;
}): Promise<AssessmentFacts> {
  const [notes, worst, reviews] = await Promise.all([
    readNotes(input.repositoryId, input.since, input.until),
    readWorstFiles(input.repositoryId),
    prisma.commitRecord.findMany({
      where: {
        repositoryId: input.repositoryId,
        reviewedAt: { not: null },
        committedAt: { gte: input.since, lt: input.until },
      },
      orderBy: { committedAt: "desc" },
      take: REVIEWS,
      select: { review: true },
    }),
  ]);

  const parsed = reviews.flatMap((row) => {
    const review = commitReviewSchema.safeParse(row.review);
    return review.success ? [review.data] : [];
  });

  return {
    notes,
    worst,
    verdicts: tallyVerdicts(parsed),
    patterns: tallyFindings(parsed),
    constitution: input.constitution,
  };
}

function tallyVerdicts(reviews: { verdict: ReviewVerdict }[]) {
  const counts = new Map<ReviewVerdict, number>();
  for (const review of reviews) counts.set(review.verdict, (counts.get(review.verdict) ?? 0) + 1);

  return [...counts]
    .map(([verdict, count]) => ({ verdict, count }))
    .sort((a, b) => b.count - a.count || (a.verdict < b.verdict ? -1 : 1));
}

/**
 * Findings that recurred, normalised only by case and whitespace.
 *
 * Deliberately not clustered by similarity: two findings counted as one because
 * a heuristic thought they rhymed would inflate a pattern that is not there, and
 * the whole value of this number is that it is countable.
 */
function tallyFindings(reviews: { findings: string[] }[]): ReviewPattern[] {
  const counts = new Map<string, { text: string; count: number }>();

  for (const review of reviews) {
    for (const finding of review.findings) {
      const key = finding.trim().toLowerCase().replace(/\s+/g, " ");
      if (!key) continue;
      const entry = counts.get(key) ?? { text: finding.trim(), count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }

  return [...counts.values()]
    .filter((entry) => entry.count >= PATTERN_MIN)
    .sort((a, b) => b.count - a.count || (a.text < b.text ? -1 : 1))
    .slice(0, 5)
    .map((entry) => ({ finding: entry.text, count: entry.count }));
}

export type { WorstFile, CheckMetric };
