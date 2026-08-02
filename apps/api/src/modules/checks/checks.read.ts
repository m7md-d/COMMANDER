/**
 * What limits a front is judged by, right now.
 *
 * Three layers resolved on every read rather than flattened at write time: a
 * template edited today must change what its fronts are judged by today, and a
 * front that overrode one threshold must keep inheriting everything it did not
 * mention. Storing the resolved result would freeze both.
 */

import { resolveChecks, type CheckConfigMap } from "@commander/shared";
import { prisma } from "@/db/prisma.js";
import { readCheckMap } from "./templates.service.js";

export async function resolveFrontChecks(repositoryId: string): Promise<CheckConfigMap> {
  const row = await prisma.repository.findUnique({
    where: { id: repositoryId },
    select: { checks: true, checkTemplate: { select: { checks: true } } },
  });
  if (!row) return resolveChecks(null, null);

  return resolveChecks(
    row.checkTemplate ? readCheckMap(row.checkTemplate.checks) : null,
    readCheckMap(row.checks),
  );
}
