/**
 * Reading the evidence, then handing it to the renderer.
 *
 * Split from `assessment.pipeline.ts` so that file imports no database: what it
 * does — turning facts into the text a model reads — is the half most worth
 * testing, and a renderer that drags Prisma in behind it cannot be tested
 * without one. The same split the modules use between `*.read` and everything
 * that shapes what was read.
 */

import type { LocaleId } from "@commander/shared";
import { createLogger } from "@/core/logger/logger.js";
import { readAssessment } from "@/modules/digest/assessment.read.js";
import { readRepoConstitution } from "@/modules/dossier/enrichment.service.js";
import { renderAssessment } from "./assessment.pipeline.js";

const log = createLogger("digest");

/**
 * The evidence for one window, read and rendered.
 *
 * A failure costs the section and never the report: the figures were the point
 * to begin with, and a digest that refused to go out because a note index was
 * unreadable would be the tail wagging the dog.
 */
export async function assessmentFor(
  repositoryId: string,
  window: { since: string; until: string },
  locale: LocaleId,
): Promise<string> {
  try {
    const facts = await readAssessment({
      repositoryId,
      since: new Date(window.since),
      until: new Date(window.until),
      constitution: await readRepoConstitution(repositoryId).catch(() => null),
    });
    return renderAssessment(locale, facts);
  } catch (error) {
    log.warn("assessment unavailable", { repositoryId, error: String(error) });
    return "";
  }
}
