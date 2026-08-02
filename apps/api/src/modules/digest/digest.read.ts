/**
 * Counting a week.
 *
 * Every number here is read from the ledger before a model sees any of it. That
 * order is the difference between an audit and a performance: a model asked to
 * summarise a week without figures will write a paragraph that reads just as
 * well and means nothing, and nobody downstream can tell the two apart.
 */

import type { DigestFacts, MemberWeek, ViolationId } from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { readCodeState } from "./code.read.js";

interface Window {
  since: Date;
  until: Date;
}

export async function readDigestFacts(
  repositoryId: string,
  window: Window,
  previousState: Record<string, number>,
): Promise<DigestFacts> {
  const [commits, events, priorEvents, pushes, members, code, credits] = await countWindow(
    repositoryId,
    window,
    previousState,
  );

  const names = new Map(members.map((member) => [member.login, member.displayName]));
  const prior = new Map(priorEvents.map((row) => [row.login, row._count._all]));

  return {
    since: window.since.toISOString(),
    until: window.until.toISOString(),
    pushes,
    commits: commits.length,
    violations: events.length,
    commendations: credits.length,
    byRule: tally(events.map((event) => event.ruleId as ViolationId)),
    members: perMember({ commits, events, credits, prior, names }),
    code,
    // A week with credits in it is not a quiet week, even with nothing charged.
    quiet:
      pushes === 0 && commits.length === 0 && events.length === 0 && credits.length === 0,
  };
}

/** Every count the digest rests on, in one round of parallel reads. */
function countWindow(repositoryId: string, window: Window, previousState: Record<string, number>) {
  return Promise.all([
    prisma.commitRecord.findMany({
      where: { repositoryId, committedAt: { gte: window.since, lt: window.until } },
      select: { login: true },
    }),
    prisma.ledgerEvent.findMany({
      where: { repositoryId, kind: "violation", occurredAt: { gte: window.since, lt: window.until } },
      select: { login: true, ruleId: true },
    }),
    // The week before, for the direction of travel. It is the one number a
    // weekly report can give that a per-push report never can.
    prisma.ledgerEvent.groupBy({
      by: ["login"],
      where: {
        repositoryId,
        kind: "violation",
        occurredAt: {
          gte: new Date(window.since.getTime() - (window.until.getTime() - window.since.getTime())),
          lt: window.since,
        },
      },
      _count: { _all: true },
    }),
    prisma.delivery.count({
      where: { repositoryId, createdAt: { gte: window.since, lt: window.until } },
    }),
    prisma.member.findMany({ where: { repositoryId }, select: { login: true, displayName: true } }),
    readCodeState(repositoryId, previousState),
    // What was earned in the same window, read the same way. The prompt already
    // asked the model to "praise whoever improved" — until now the only thing it
    // could mean by improvement was committing fewer offences than last week.
    prisma.ledgerEvent.findMany({
      where: {
        repositoryId,
        kind: "commendation",
        occurredAt: { gte: window.since, lt: window.until },
      },
      select: { login: true, ruleId: true },
    }),
  ] as const);
}

function tally(ids: ViolationId[]): { ruleId: ViolationId; count: number }[] {
  const counts = new Map<ViolationId, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);

  // Worst first, ties by id so two identical weeks do not reshuffle themselves.
  return [...counts]
    .map(([ruleId, count]) => ({ ruleId, count }))
    .sort((a, b) => b.count - a.count || (a.ruleId < b.ruleId ? -1 : 1));
}

function perMember(input: {
  commits: { login: string }[];
  events: { login: string }[];
  credits: { login: string }[];
  prior: Map<string, number>;
  names: Map<string, string>;
}): MemberWeek[] {
  const rows = new Map<string, MemberWeek>();
  const row = (login: string): MemberWeek => {
    const existing = rows.get(login);
    if (existing) return existing;

    const fresh: MemberWeek = {
      login,
      // Someone who pushed but was never enrolled still belongs in the week.
      displayName: input.names.get(login) || login,
      pushes: 0,
      commits: 0,
      violations: 0,
      commendations: 0,
      delta: -(input.prior.get(login) ?? 0),
    };
    rows.set(login, fresh);
    return fresh;
  };

  for (const commit of input.commits) row(commit.login).commits += 1;
  for (const event of input.events) {
    const member = row(event.login);
    member.violations += 1;
    member.delta += 1;
  }
  // Counted, never subtracted from `delta`: a credit does not cancel a charge,
  // and letting it would let someone tidy one file to erase what they broke in
  // another.
  for (const credit of input.credits) row(credit.login).commendations += 1;

  return [...rows.values()].sort(
    (a, b) => b.commits - a.commits || (a.login < b.login ? -1 : 1),
  );
}
