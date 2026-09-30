/**
 * A merge that lands a branch, judged against its own parents (0009 §4).
 *
 * Read only between the push's two ends, a landing mixes three people's work
 * into one number: the branch's, main's since the branch forked, and whatever
 * the merger wrote into the merge itself. Read against the push's base alone, a
 * branch adding 20 lines to a file while main added 40 — each under the limit,
 * joined over it by the merge — charged the branch's author with a crossing she
 * never made (scenario `crossing-made-by-combining-two-edits`). So each part is
 * read where it happened: the branch from where it forked to its head, and the
 * merge against what git makes of its parents unaided. Where one side left a
 * file alone, that is the other side's version; anything else is the merger's.
 * Where both sides changed it, nothing says which lines are whose, and the
 * merge's own share is not judged. And where more than one author changed a
 * file on the branch, the branch is read hand by hand from its fork (0011).
 */

import { isGitHubUiCommit, isMerge, type CheckConfigMap, type Finding, type NormalizedPush, type PushWeight } from "@commander/shared";
import { judgeFile, type CheckOutcome, type Reading } from "@/domain/checks/judge.js";
import type { TouchedFile } from "@/domain/tree/diff.js";
import { handsOnPaths, soleHand, type Named } from "./attribution.js";
import { judgeHands, lineOf, readHands, type HandShares } from "./hands.js";

/** The merge a push lands, and its parents: the line it lands on, and the branch it brings. */
export interface Landing {
  merge: string;
  first: string;
  second: string;
}

/**
 * The merge this push lands, when the push is one landing: its head a
 * two-parent merge onto the branch's previous head, every other commit the
 * branch's own. Worth reading only when the merge may hold work of its own — one
 * made on a laptop — or the branch brings work not yet on record, which is
 * judged from where it forked. A merge GitHub made of a branch already on record
 * is neither: GitHub's button merges only what merges cleanly.
 */
export function landingMerge(input: { push: NormalizedPush; knownShas: ReadonlySet<string> }): Landing | null {
  const { push, knownShas } = input;
  const merge = push.commits.find((commit) => commit.sha === push.after);
  const [first, second, ...more] = merge?.parents ?? [];
  if (!merge || !first || !second || more.length > 0 || first !== push.before) return null;

  const brought = push.commits.filter((commit) => commit !== merge);
  if (brought.some((commit) => commit.parents === undefined || isMerge(commit))) return null;
  const unjudged = brought.some((commit) => !knownShas.has(commit.sha));
  return !isGitHubUiCommit(merge) || unjudged ? { merge: merge.sha, first, second } : null;
}

/** Every version a landing needs, as blobs by path, and what the branch did since it forked. */
export interface LandingSides {
  /** The merge commit, whose author answers for the merge's own work. */
  merge: string;
  /** The branch's own changes: its fork's listing against its head's (`pushChanges`), move-aware. */
  branch: TouchedFile[];
  first: ReadonlyMap<string, string>;
  fork: ReadonlyMap<string, string>;
  second: ReadonlyMap<string, string>;
  merged: ReadonlyMap<string, string>;
  /** The text of each version `resolutionsOf` names, where it could be read (D-25). */
  contents?: ReadonlyMap<string, string>;
}

export interface LandingScope {
  push: NormalizedPush;
  weight: PushWeight;
  knownShas: ReadonlySet<string>;
  config: CheckConfigMap;
  readings: ReadonlyMap<string, Reading>;
  pusher: string | null;
  trunk: boolean;
}

export interface LandingOutcome {
  violations: Named[];
  commendations: Named[];
  /** Crossings left on a main line that neither the pusher's branch work nor their merge made. */
  landed: Finding[];
}

/**
 * The landing, path by path: the branch's work charged to its author when none
 * of it is on record yet, the merge's own work to the merge's author, and what
 * crossed on a main line — unless the pusher made it — landed by the pusher.
 */
export function judgeLanding(net: TouchedFile[], sides: LandingSides, scope: LandingScope): LandingOutcome {
  const outcome: LandingOutcome = { violations: [], commendations: [], landed: [] };
  const context = contextOf(sides, scope);
  const onTrunk = new Map(net.map((file) => [file.path, file]));
  const onBranch = new Map(sides.branch.map((file) => [file.path, file]));

  for (const path of new Set([...onTrunk.keys(), ...onBranch.keys()])) {
    const v = versionsOf(path, { trunk: onTrunk.get(path), branch: onBranch.get(path), sides });
    const wrote = context.shares.get(path) ?? judged(branchWork(path, v, context), soleHand(context.hands.get(path) ?? new Set()));
    const made = judged(mergeWork(path, v, scope), context.merger);
    for (const share of [wrote, made]) {
      outcome.violations.push(...share.violations);
      outcome.commendations.push(...share.commendations);
    }

    const file = onTrunk.get(path);
    if (!scope.trunk || !file) continue;
    const mine = [wrote, made].some((share) => share.violations.some((hit) => hit.login !== null && hit.login === scope.pusher));
    if (!mine) outcome.landed.push(...judgeFile(scope.config, file, scope.readings).violations);
  }
  return outcome;
}

/** Who wrote each path on the branch, which paths commits already on record touched, and who made the merge. */
function contextOf(sides: LandingSides, scope: LandingScope) {
  const { push, weight, knownShas } = scope;
  const brought = push.commits.filter((commit) => commit.sha !== sides.merge);
  const work = weight.work.filter((entry) => entry.sha !== sides.merge);
  // Where more than one author changed a file on the branch, each hand from the fork (0011).
  const hands = readHands({ ...lineOf({ push, base: sides.first, landing: sides }), knownShas });
  const shares: HandShares = hands ? judgeHands(hands, scope) : new Map();
  return {
    ...scope,
    shares,
    hands: handsOnPaths(push, { ...weight, work }),
    carried: new Set(brought.filter((commit) => knownShas.has(commit.sha)).flatMap((commit) => commit.paths ?? [])),
    merger: push.commits.find((commit) => commit.sha === sides.merge)?.authorLogin || null,
  };
}

interface Versions {
  first: string | null;
  fork: string | null;
  second: string | null;
  merged: string | null;
}

/** A path's blob at the base, the fork, the branch head and the merge — following a move where either side made one. */
function versionsOf(path: string, parts: { trunk?: TouchedFile; branch?: TouchedFile; sides: LandingSides }): Versions {
  const { trunk, branch, sides } = parts;
  return {
    first: trunk ? trunk.previousSha : (sides.first.get(path) ?? null),
    merged: trunk ? trunk.sha : (sides.merged.get(path) ?? null),
    fork: branch ? branch.previousSha : (sides.fork.get(path) ?? null),
    second: branch ? branch.sha : (sides.second.get(path) ?? null),
  };
}

/** The branch's own change to a path, from where it forked — judged only when every commit that made it is new. */
function branchWork(path: string, v: Versions, context: ReturnType<typeof contextOf>): CheckOutcome | null {
  if (v.second === null || v.second === v.fork || !context.hands.has(path) || context.carried.has(path)) return null;
  return judgeFile(context.config, { path, sha: v.second, previousSha: v.fork }, context.readings);
}

/**
 * The merge's own change to a path: what it wrote beyond what git makes of its
 * parents unaided. A merge that took one side's version wrote nothing, and one
 * whose sides both changed the file cannot be told from git's own joining.
 */
function mergeWork(path: string, v: Versions, scope: LandingScope): CheckOutcome | null {
  const unaided = v.second === v.fork ? v.first : v.first === v.fork ? v.second : undefined;
  if (unaided === undefined || v.merged === null || v.merged === v.first || v.merged === v.second) return null;
  return judgeFile(scope.config, { path, sha: v.merged, previousSha: unaided }, scope.readings);
}

function judged(outcome: CheckOutcome | null, login: string | null): { violations: Named[]; commendations: Named[] } {
  return {
    violations: (outcome?.violations ?? []).map((finding) => ({ ...finding, login })),
    commendations: (outcome?.commendations ?? []).map((finding) => ({ ...finding, login })),
  };
}
