/**
 * The decision about a push, in one place and with no I/O (0009 §1).
 *
 * The processor gathers the facts — the repository, GitHub's view of each
 * commit, the shas already on record, what the checks measured — and then does
 * what these two functions say. Which pushes are read, which are judged, what
 * each is charged with and who answers for it, whether the result is recorded
 * and whether it is sent: all of it is answered here, and none of it there.
 *
 * The scenario reference (`src/scenarios/`) calls these same functions on the
 * pushes a real repository produces. A decision made anywhere else is one the
 * reference has to copy, and a copy is where a test and the worker drift apart.
 */

import {
  branchIsWatched,
  isTrunk,
  weighPush,
  type CheckConfigMap,
  type Commendation,
  type Finding,
  type NormalizedPush,
  type PushWeight,
  type Repository,
  type RuleConfigMap,
  type ViolationHit,
  type Watcher,
} from "@commander/shared";
import { judgeFile, type Reading } from "@/domain/checks/judge.js";
import type { TouchedFile } from "@/domain/tree/diff.js";
import type { RuleErrorReporter } from "@/domain/violations/engine.js";
import { answered, handsOnPaths, judgeRules, pusherOf, soleHand } from "./attribution.js";
import { judgeLanding, type LandingOutcome, type LandingSides } from "./landing.js";

/**
 * Whether a push is read, and whether it is judged. Read without being judged
 * is a real state: a push with no commits still moved the code, so the tree is
 * refreshed from it even though nothing in it can be charged.
 */
export type Admission =
  | { read: false; reason: "repo_disabled" | "branch_not_watched" }
  | { read: true; judged: false; reason: "no_commits" }
  | { read: true; judged: true };

export function admitPush(input: {
  repository: Pick<Repository, "enabled" | "branches">;
  push: NormalizedPush;
}): Admission {
  const { repository, push } = input;

  if (!repository.enabled) return { read: false, reason: "repo_disabled" };
  if (!branchIsWatched(repository.branches, push.branch)) return { read: false, reason: "branch_not_watched" };
  // A branch deletion carries no commits but is still worth reporting.
  if (push.commits.length === 0 && !push.deleted) return { read: true, judged: false, reason: "no_commits" };
  return { read: true, judged: true };
}

/** What the checks have to go on: the push's own changes (`changes.ts`), and their measurements. */
export interface ChecksFacts {
  config: CheckConfigMap;
  /** Every file the push changed between its base and head, with the blob it replaced. */
  changes: TouchedFile[];
  /** Measurements by blob hash — both sides of every change, where they could be taken. */
  readings: ReadonlyMap<string, Reading>;
  /**
   * When the push lands a merge (`landingMerge`), its branch and its fork, so the
   * landing is judged against its own parents rather than the push's base alone.
   */
  landing?: LandingSides;
}

export interface PushFacts {
  /** The push as enrichment left it. */
  push: NormalizedPush;
  /** Shas already in `commit_records`: the work this repository had seen before. */
  knownShas: ReadonlySet<string>;
  rules: RuleConfigMap;
  timezoneOffset: number;
  /** The repository's watchers — which, with the default branch, say what a main line is. */
  watchers: Watcher[];
  checks: ChecksFacts;
  silentWhenClean: boolean;
  /** Whether there is a channel to send to at all. */
  hasChannel: boolean;
}

/** Why a judged push is not reported. */
export type Withheld = "clean_and_silent" | "discord_missing";

export type Judgement = {
  /** The rules' charges, then the checks' — each naming who answers for it. */
  violations: ViolationHit[];
  commendations: Commendation[];
  /**
   * Found, with nobody the evidence names to answer for it: a commit whose
   * author's address belongs to no account, a file two people changed in one
   * push, what a recovered push did. Charged to nobody, and logged.
   */
  unattributed: Finding[];
  /** Whoever pushed: whose push this counts as. Null for a recovered push. */
  pusher: string | null;
} & (
  // Written to the record — commits, counters, ledger — and then reported.
  | { recorded: true; withheld: null }
  // Neither. Recording is still tied to sending here; 0009 §5 separates them.
  | { recorded: false; withheld: Withheld }
);

export function judgePush(facts: PushFacts, onRuleError: RuleErrorReporter): Judgement {
  const { push, knownShas } = facts;
  const weight = weighPush({ push, knownShas });
  const checked = judgeChecks(facts, weight);
  const rules = { rules: facts.rules, timezoneOffset: facts.timezoneOffset, landed: checked.landed };
  const found = [...judgeRules({ push, weight, knownShas, ...rules }, onRuleError), ...checked.violations];
  const judged = {
    violations: answered(found),
    commendations: answered(checked.commendations),
    unattributed: [...found, ...checked.commendations]
      .filter((entry) => entry.login === null)
      .map(({ ruleId, detail }) => ({ ruleId, detail })),
    pusher: pusherOf(push),
  };

  const withheld = withholding(facts, judged.violations.length + judged.commendations.length);
  return withheld === null ? { ...judged, recorded: true, withheld } : { ...judged, recorded: false, withheld };
}

/**
 * The checks, each finding naming whose work it was, and the crossings the push
 * left on a main line from others' work. A push that cannot be weighed has no new
 * work to tell from carried work, and nothing is judged.
 */
function judgeChecks(facts: PushFacts, weight: PushWeight): LandingOutcome {
  const { push, knownShas, checks } = facts;
  const none: LandingOutcome = { violations: [], commendations: [], landed: [] };
  if (!weight.measured) return none;

  const pusher = pusherOf(push);
  const trunk = isTrunk({ branch: push.branch, defaultBranch: push.defaultBranch, watchers: facts.watchers });
  if (checks.landing) {
    const scope = { push, weight, knownShas, config: checks.config, readings: checks.readings, pusher, trunk };
    return judgeLanding(checks.changes, checks.landing, scope);
  }
  return judgeChanges(checks, { hands: handsOnPaths(push, weight), pusher, trunk });
}

/**
 * Any other push, between its two ends.
 *
 * A file only carried by commits already on record was judged when they
 * arrived: its author is not charged again. On a main line it is still landed —
 * by whoever merged it unfixed.
 */
function judgeChanges(checks: ChecksFacts, scope: { hands: Map<string, Set<string | null>>; pusher: string | null; trunk: boolean }) {
  const outcome: LandingOutcome = { violations: [], commendations: [], landed: [] };

  for (const file of checks.changes) {
    const hands = scope.hands.get(file.path);
    if (hands === undefined && !scope.trunk) continue;

    const judged = judgeFile(checks.config, file, checks.readings);
    const login = hands === undefined ? null : soleHand(hands);
    if (hands !== undefined) {
      outcome.violations.push(...judged.violations.map((finding) => ({ ...finding, login })));
      outcome.commendations.push(...judged.commendations.map((finding) => ({ ...finding, login })));
    }
    // The pusher's own new work is charged once, as its author.
    const own = scope.pusher !== null && login === scope.pusher;
    if (scope.trunk && !own) outcome.landed.push(...judged.violations);
  }
  return outcome;
}

function withholding(facts: PushFacts, findings: number): Withheld | null {
  // A push that only fixed things is not a clean push in the sense this flag
  // means. The setting exists to stop routine work filling a channel, and
  // someone taking a file back under its limit is the one thing here worth
  // interrupting for.
  if (facts.silentWhenClean && findings === 0) return "clean_and_silent";
  if (!facts.hasChannel) return "discord_missing";
  return null;
}
