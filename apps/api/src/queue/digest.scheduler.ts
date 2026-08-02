/**
 * Deciding when a week is over.
 *
 * The decision is read from the database, never from how long this process has
 * been up. A `setInterval` would send the digest twice if the laptop restarted
 * on Monday morning, or skip it entirely if it restarted on Sunday night — and
 * which of the two you got would depend on nothing anybody could see. Storing
 * `lastRunAt` makes a restart irrelevant, which is the same lesson
 * `recoverOrphans()` forced on the queue.
 *
 * What `lastRunAt` records is *which scheduled instant has been served* — not
 * "when the last one happened to go out". The distinction is the whole reason
 * the hour stops drifting: every window closes on the named instant, so a tick
 * that runs forty minutes late still reports a window ending at 09:00.
 */

import {
  DEFAULT_SCHEDULE,
  digestDueAt,
  schedulesSchema,
  type DigestTrigger,
  type ScheduleConfig,
} from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { createLogger, describeError } from "@/core/logger/logger.js";
import { getSettings } from "@/modules/settings/settings.service.js";
import { enqueue } from "./outbox.service.js";

const log = createLogger("digest");

const KIND = "weekly_digest";

export async function scheduleDigests(now = new Date()): Promise<void> {
  const repositories = await prisma.repository.findMany({
    where: { enabled: true },
    select: { id: true, fullName: true, schedules: true },
  });

  // One read for the whole sweep: the hour an operator means by "09:00" is a
  // global setting, and re-reading it per front would be the same answer N times.
  const { timezoneOffset } = await getSettings();

  for (const repository of repositories) {
    try {
      await scheduleOne(repository, now, timezoneOffset);
    } catch (error) {
      log.error("digest schedule failed", { repo: repository.fullName, ...describeError(error) });
    }
  }
}

/** The front's own rhythm, or the shipped one. Malformed stored JSON degrades to
 *  the default rather than silently never reporting. */
export function readSchedule(stored: unknown): ScheduleConfig {
  return schedulesSchema.safeParse(stored).data?.weekly_digest ?? DEFAULT_SCHEDULE;
}

async function scheduleOne(
  repository: { id: string; fullName: string; schedules: unknown },
  now: Date,
  timezoneOffset: number,
): Promise<void> {
  const config = readSchedule(repository.schedules);
  const schedule = await anchor(repository.id, now);

  const until = digestDueAt({ lastRunAt: schedule.lastRunAt, now, config, timezoneOffset });
  if (!until || !schedule.lastRunAt) return;

  await queueDigest({
    schedule,
    repository,
    since: schedule.lastRunAt,
    until,
    trigger: "schedule",
  });
}

/**
 * The schedule row, created on first sight with `lastRunAt` set to now and
 * nothing sent: a week nobody was watching cannot be summarised, so the anchor
 * is planted and the first real digest arrives at the next scheduled instant.
 */
export function anchor(repositoryId: string, now: Date) {
  return prisma.reportSchedule.upsert({
    where: { repositoryId_kind: { repositoryId, kind: KIND } },
    create: { repositoryId, kind: KIND, lastRunAt: now },
    update: {},
  });
}

/**
 * Queues a digest, and — only for a scheduled one — closes the window behind it.
 *
 * The trigger decides that, and it is the only difference between the two paths.
 * A manual report is a *reading* of the open window: it moves no anchor, so the
 * scheduled report still covers the whole week, including everything the manual
 * one already showed. Anything else would make the button a trap — press it on
 * Sunday and Monday's report quietly never arrives.
 */
export async function queueDigest(input: {
  schedule: { id: string };
  repository: { id: string; fullName: string };
  since: Date;
  until: Date;
  trigger: DigestTrigger;
}): Promise<{ deliveryId: string }> {
  const { schedule, repository, since, until, trigger } = input;

  // Stamped *before* the job is queued, so a crash between the two costs one
  // digest rather than producing an endless stream of them on every tick.
  if (trigger === "schedule") {
    await prisma.reportSchedule.update({
      where: { id: schedule.id },
      data: { lastRunAt: until },
    });
  }

  const delivery = await enqueue({
    repositoryId: repository.id,
    occasion: {
      kind: KIND,
      repositoryId: repository.id,
      repoFullName: repository.fullName,
      since: since.toISOString(),
      until: until.toISOString(),
      trigger,
    },
  });

  log.info("digest queued", { repo: repository.fullName, trigger, until: until.toISOString() });
  return { deliveryId: delivery.id };
}
