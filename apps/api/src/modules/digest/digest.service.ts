/**
 * An interim reading, on the operator's word rather than the calendar's.
 *
 * It exists because the alternative was worse: seeing what the digest would say
 * meant back-dating `last_run_at` by hand in psql, and an operator who has to
 * edit the database to see a feature will conclude it does not work.
 *
 * It is a real send — the same pipeline, the same figures, the same channel —
 * and it **takes nothing from the schedule**. The window it reads stays open:
 * `lastRunAt` is untouched, so Monday's report still covers the whole week
 * including everything this one already showed, and `lastState` is untouched, so
 * Monday still measures its change against last Monday rather than against this
 * moment. A button that quietly consumed the week would be worse than no button.
 */

import { DIGEST_PERIOD_MS } from "@commander/shared";
import { NotFoundError } from "@/core/errors/app-error.js";
import { prisma } from "@/db/prisma.js";
import { anchor, queueDigest } from "@/queue/digest.scheduler.js";

export async function sendDigestNow(repositoryId: string): Promise<{ deliveryId: string }> {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { id: true, fullName: true, enabled: true },
  });
  if (!repository || !repository.enabled) throw new NotFoundError("repos.notFound");

  const now = new Date();
  const schedule = await anchor(repository.id, now);

  // Since the last scheduled report if there has been one, and otherwise since
  // the anchor — "what has happened since the last weekly report, if any". A
  // front anchored this second has nothing to read, so a period back is the only
  // window that is not empty by construction.
  const since = schedule.lastRunAt ?? new Date(now.getTime() - DIGEST_PERIOD_MS);

  return queueDigest({ schedule, repository, since, until: now, trigger: "manual" });
}
