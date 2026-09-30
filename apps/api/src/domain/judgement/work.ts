/**
 * The checks on any push that is not a landing: its changes between its two
 * ends, each charged to the one author whose new work changed the file — and,
 * where more than one did, hand by hand (`hands.ts`, 0011).
 *
 * A file only carried by commits already on record was judged when they
 * arrived: its author is not charged again. On a main line it is still landed —
 * by whoever merged it unfixed.
 */

import type { CheckConfigMap, NormalizedPush, PushWeight } from "@commander/shared";
import { judgeFile, type Reading } from "@/domain/checks/judge.js";
import type { TouchedFile } from "@/domain/tree/diff.js";
import { handsOnPaths, soleHand } from "./attribution.js";
import { judgeHands, lineOf, readHands, type HandShares } from "./hands.js";
import type { LandingOutcome } from "./landing.js";

export interface WorkFacts {
  config: CheckConfigMap;
  changes: TouchedFile[];
  readings: ReadonlyMap<string, Reading>;
  /** The listing at the push's base: where the first hand starts from. */
  base?: ReadonlyMap<string, string>;
}

export interface WorkScope {
  push: NormalizedPush;
  weight: PushWeight;
  knownShas: ReadonlySet<string>;
  pusher: string | null;
  trunk: boolean;
}

export function judgeWork(checks: WorkFacts, scope: WorkScope): LandingOutcome {
  const outcome: LandingOutcome = { violations: [], commendations: [], landed: [] };
  const hands = handsOnPaths(scope.push, scope.weight);
  const shares = sharesOf(checks, scope);
  for (const share of shares.values()) {
    outcome.violations.push(...share.violations);
    outcome.commendations.push(...share.commendations);
  }

  for (const file of checks.changes) {
    const who = hands.get(file.path);
    if (who === undefined && !scope.trunk) continue;

    const judged = judgeFile(checks.config, file, checks.readings);
    const share = shares.get(file.path);
    const login = who === undefined ? null : soleHand(who);
    if (who !== undefined && share === undefined) {
      outcome.violations.push(...judged.violations.map((finding) => ({ ...finding, login })));
      outcome.commendations.push(...judged.commendations.map((finding) => ({ ...finding, login })));
    }
    // The pusher's own new work is charged once, as its author.
    const own = share ? share.violations.some((hit) => hit.login !== null && hit.login === scope.pusher) : scope.pusher !== null && login === scope.pusher;
    if (scope.trunk && !own) outcome.landed.push(...judged.violations);
  }
  return outcome;
}

/** Paths more than one author changed, judged hand by hand — none when the line cannot be read so. */
function sharesOf(checks: WorkFacts, scope: WorkScope): HandShares {
  if (!checks.base) return new Map();
  const read = readHands({ ...lineOf({ push: scope.push, base: checks.base }), knownShas: scope.knownShas });
  return read ? judgeHands(read, checks) : new Map();
}
