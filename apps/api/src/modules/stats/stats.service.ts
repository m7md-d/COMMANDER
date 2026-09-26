import type { MemberStat, OverviewStats, ViolationHit } from "@commander/shared";
import { prisma } from "@/db/prisma.js";

/**
 * Counters. Unlike the KV-backed predecessor these are exact: the increment is
 * an atomic upsert inside the same transaction as the delivery record, so
 * concurrent pushes from one member cannot lose a count.
 */

function readCounts(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null) return {};
  const entries = Object.entries(value as Record<string, unknown>);
  return Object.fromEntries(
    entries.filter((entry): entry is [string, number] => typeof entry[1] === "number"),
  );
}

interface Standing {
  totalCommits: number;
  totalPushes: number;
  violationCounts: Record<string, number>;
}

/**
 * Advances every counter one push touches, each on the member it belongs to:
 * the push on whoever pushed, each commit on the member it is filed under, each
 * charge on whoever answers for it. Returns the standing of `addressee` — whom
 * the communiqué speaks to — with this push included.
 */
export async function recordPush(input: {
  repositoryId: string;
  /** Null for a recovered push, which nobody is known to have made. */
  pusher: string | null;
  /** Commits new to the record, by the member each is filed under. */
  commits: ReadonlyMap<string, number>;
  violations: ViolationHit[];
  addressee: string;
}): Promise<Standing> {
  const logins = new Set([input.addressee, ...input.commits.keys(), ...input.violations.map((hit) => hit.login)]);
  if (input.pusher) logins.add(input.pusher);

  let cited: Standing = { totalCommits: 0, totalPushes: 0, violationCounts: {} };
  for (const login of logins) {
    const standing = await tally(input.repositoryId, login, {
      commits: input.commits.get(login) ?? 0,
      pushes: login === input.pusher ? 1 : 0,
      charges: input.violations.filter((hit) => hit.login === login),
    });
    if (login === input.addressee) cited = standing;
  }
  return cited;
}

/** One member's counters, advanced atomically by what this push added to them. */
async function tally(
  repositoryId: string,
  login: string,
  added: { commits: number; pushes: number; charges: ViolationHit[] },
): Promise<Standing> {
  const now = new Date();
  const existing = await prisma.memberStat.findUnique({
    where: { repositoryId_login: { repositoryId, login } },
  });

  const counts = readCounts(existing?.violationCounts);
  for (const hit of added.charges) {
    counts[hit.ruleId] = (counts[hit.ruleId] ?? 0) + 1;
  }

  const row = await prisma.memberStat.upsert({
    where: { repositoryId_login: { repositoryId, login } },
    create: {
      repositoryId,
      login,
      totalCommits: added.commits,
      totalPushes: added.pushes,
      violationCounts: counts,
      firstSeenAt: now,
      lastSeenAt: now,
    },
    update: {
      totalCommits: { increment: added.commits },
      totalPushes: { increment: added.pushes },
      violationCounts: counts,
      lastSeenAt: now,
    },
  });

  return {
    totalCommits: row.totalCommits,
    totalPushes: row.totalPushes,
    violationCounts: readCounts(row.violationCounts),
  };
}

export async function listMemberStats(repositoryId: string): Promise<MemberStat[]> {
  const [rows, members] = await Promise.all([
    prisma.memberStat.findMany({ where: { repositoryId }, orderBy: { totalCommits: "desc" } }),
    prisma.member.findMany({ where: { repositoryId } }),
  ]);

  const identity = new Map(members.map((member) => [member.login.toLowerCase(), member]));

  return rows.map((row) => {
    const counts = readCounts(row.violationCounts);
    const member = identity.get(row.login.toLowerCase());

    return {
      login: row.login,
      displayName: member?.displayName ?? "",
      rank: member?.rank ?? "",
      totalCommits: row.totalCommits,
      totalPushes: row.totalPushes,
      violationCounts: counts,
      violationTotal: Object.values(counts).reduce((sum, count) => sum + count, 0),
      firstSeenAt: row.firstSeenAt?.toISOString() ?? null,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    };
  });
}

export async function resetStats(repositoryId: string): Promise<number> {
  const { count } = await prisma.memberStat.deleteMany({ where: { repositoryId } });
  return count;
}

export async function getOverview(): Promise<OverviewStats> {
  const [repositoryCount, memberCount, aggregate, pending, failed, stats] = await Promise.all([
    prisma.repository.count(),
    prisma.member.count(),
    prisma.memberStat.aggregate({ _sum: { totalPushes: true } }),
    prisma.delivery.count({ where: { status: "pending" } }),
    prisma.delivery.count({ where: { status: "failed" } }),
    prisma.memberStat.findMany({ select: { violationCounts: true } }),
  ]);

  const violationCount = stats.reduce((total, row) => {
    const counts = readCounts(row.violationCounts);
    return total + Object.values(counts).reduce((sum, count) => sum + count, 0);
  }, 0);

  return {
    repositoryCount,
    memberCount,
    pushCount: aggregate._sum.totalPushes ?? 0,
    violationCount,
    pendingDeliveries: pending,
    failedDeliveries: failed,
  };
}
