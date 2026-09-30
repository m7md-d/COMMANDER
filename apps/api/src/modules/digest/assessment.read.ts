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

import type { CheckMetric } from "@commander/shared";
import { readNotes, type NoteIndex } from "@/modules/todos/todos.read.js";
import { readWorstFiles, type WorstFile } from "./worst.read.js";

export interface AssessmentFacts {
  notes: NoteIndex;
  /** The files furthest over their limits, with the numbers that prove it. */
  worst: WorstFile[];
  /** The repository's own rules document, or null when it has none. Quoted, not
   *  obeyed — see the prompt's untrusted-data wrapper. */
  constitution: string | null;
}

/**
 * Measurements and the repository's own words — never a model's. Code-review
 * verdicts and their repeated findings used to be here; they are a model's
 * text, and counted as facts they let one model's opinion become the next
 * one's evidence (0009 §7, D-37).
 */
export async function readAssessment(input: {
  repositoryId: string;
  since: Date;
  until: Date;
  constitution: string | null;
}): Promise<AssessmentFacts> {
  const [notes, worst] = await Promise.all([
    readNotes(input.repositoryId, input.since, input.until),
    readWorstFiles(input.repositoryId),
  ]);
  return { notes, worst, constitution: input.constitution };
}

export type { WorstFile, CheckMetric };
