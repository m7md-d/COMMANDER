import type { DossierSummary, ToleranceTier } from "@commander/shared";
import { LEDGER_KINDS, type LedgerKind } from "@commander/shared";
import { prisma } from "@/db/prisma.js";

/**
 * The roster. Reads the cached score rather than recomputing every member —
 * the detail view is where the authoritative recomputation happens.
 *
 * The violation count is *not* cached alongside it: it is the one figure that
 * never decays, so counting the ledger keeps the roster and the open dossier
 * from ever disagreeing about it.
 */
export async function listDossiers(repositoryId: string): Promise<DossierSummary[]> {
  const [rows, members, counts] = await Promise.all([
    prisma.memberDossier.findMany({ where: { repositoryId }, orderBy: { riskScore: "desc" } }),
    prisma.member.findMany({ where: { repositoryId } }),
    // Both kinds in one pass, grouped by kind: the roster shows what someone is
    // charged with *and* what they were credited for, and reading only the first
    // is how a board of names turns into a list of suspects.
    prisma.ledgerEvent.groupBy({
      by: ["login", "kind"],
      where: { repositoryId, kind: { in: [...LEDGER_KINDS] } },
      _count: { _all: true },
    }),
  ]);

  const names = new Map(members.map((member) => [member.login.toLowerCase(), member.displayName]));
  const tally = (kind: LedgerKind) =>
    new Map(
      counts
        .filter((entry) => entry.kind === kind)
        .map((entry) => [entry.login.toLowerCase(), entry._count._all]),
    );
  const violations = tally("violation");
  const commendations = tally("commendation");
  const scored = new Map(rows.map((row) => [row.login.toLowerCase(), row]));

  // Configured members are listed even with no stored record: a roster built
  // from scores alone would show only offenders, and the clean member — whose
  // standing is the whole point of a tolerance tier — would be unreachable.
  // Ledger casing wins where both exist, because that is what the detail
  // lookup matches on.
  const logins = new Map<string, string>();
  for (const member of members) logins.set(member.login.toLowerCase(), member.login);
  for (const row of rows) logins.set(row.login.toLowerCase(), row.login);

  return [...logins]
    .map(([key, login]) => {
      const row = scored.get(key);
      return {
        login,
        displayName: names.get(key) ?? "",
        tier: (row?.toleranceTier ?? "exemplary") as ToleranceTier,
        riskScore: row?.riskScore ?? 0,
        cleanStreakDays: row?.cleanStreakDays ?? 0,
        totalViolations: violations.get(key) ?? 0,
        totalCommendations: commendations.get(key) ?? 0,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}
