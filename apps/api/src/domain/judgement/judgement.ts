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
import type { Reading } from "@/domain/checks/judge.js";
import type { TouchedFile } from "@/domain/tree/diff.js";
import type { RuleErrorReporter } from "@/domain/violations/engine.js";
import { answered, judgeRules, pusherOf } from "./attribution.js";
import { classifyPush, judgedShas, type PullFact, type PushKind } from "./event.js";
import { judgeLanding, type LandingOutcome, type LandingSides } from "./landing.js";
import { writtenInResolution } from "./resolution.js";
import { judgeWork } from "./work.js";

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
  // A deletion and a rewind carry no commits and are still worth reporting: a
  // forced push that only removes commits deletes history from the branch.
  if (push.commits.length === 0 && !push.deleted && !push.forced) return { read: true, judged: false, reason: "no_commits" };
  return { read: true, judged: true };
}

/** What the checks have to go on: the push's own changes (`changes.ts`), and their measurements. */
export interface ChecksFacts {
  config: CheckConfigMap;
  /** Every file the push changed between its base and head, with the blob it replaced. */
  changes: TouchedFile[];
  /** Measurements by blob hash — both sides of every change, and each hand's where hands shared a file. */
  readings: ReadonlyMap<string, Reading>;
  /**
   * The listing at the push's base, blob by path: where the first hand in the
   * push starts from, when two authors changed one file (`hands.ts`, 0011).
   */
  base?: ReadonlyMap<string, string>;
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
  /** Whether a pull request landed the push, as GitHub answered (`PullFact`). */
  pull: PullFact;
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
   * push that could not be read hand by hand, what a recovered push did that no
   * event names a pusher for. Charged to nobody, and logged.
   */
  unattributed: Finding[];
  /**
   * The commits this push brought the record, by sha — new work, what the
   * communiqué lists. The rest it only carried, judged when they arrived; a
   * landing listing its whole branch read as a heap pushed at once (0009 §7).
   */
  fresh: string[];
  /** Whoever pushed: whose push this counts as. Null for a recovered push. */
  pusher: string | null;
  /** What happened (`classifyPush`), and the pull request that landed it — for the communiqué to say. */
  event: { kind: PushKind; pull: number | null };
  /** Whether the push was on a main line (`isTrunk`): kept with every charge, which weighs double there. */
  mainLine: boolean;
  /**
   * Why the communiqué is not sent — and only that. Every judged push is
   * recorded, commits, counters and ledger alike, whatever this says:
   * `silentWhenClean` means "do not send", not "do not remember" (0009 §5).
   */
  withheld: Withheld | null;
};

export function judgePush(facts: PushFacts, onRuleError: RuleErrorReporter): Judgement {
  const { push, pull } = facts;
  const kind = classifyPush({ push, pull });
  // A squash or a rebase re-delivers a branch already judged, under new shas.
  const knownShas = judgedShas({ push, pull, knownShas: facts.knownShas });
  const weight = weighPush({ push, knownShas });
  const trunk = isTrunk({ branch: push.branch, defaultBranch: push.defaultBranch, watchers: facts.watchers });
  const checked = judgeChecks({ ...facts, knownShas }, { weight, trunk });
  const rules = { kind, trunk, rules: facts.rules, timezoneOffset: facts.timezoneOffset, landed: checked.landed, ...resolvedIn(facts.checks) };
  const found = [...judgeRules({ push, weight, knownShas, ...rules }, onRuleError), ...checked.violations];
  const judged = {
    violations: answered(found),
    commendations: answered(checked.commendations),
    unattributed: [...found, ...checked.commendations]
      .filter((entry) => entry.login === null)
      .map(({ ruleId, detail }) => ({ ruleId, detail })),
    fresh: push.commits.filter((commit) => !knownShas.has(commit.sha)).map((commit) => commit.sha),
    pusher: pusherOf(push),
    event: { kind, pull: pull.status === "landed" ? pull.number : null },
    mainLine: trunk,
  };

  return { ...judged, withheld: withholding(facts, judged.violations.length + judged.commendations.length) };
}

/**
 * The checks, each finding naming whose work it was, and the crossings the push
 * left on a main line from others' work. A push that cannot be weighed has no new
 * work to tell from carried work, and nothing is judged.
 */
function judgeChecks(facts: PushFacts, on: { weight: PushWeight; trunk: boolean }): LandingOutcome {
  const { push, knownShas, checks } = facts;
  const { weight, trunk } = on;
  if (!weight.measured) return { violations: [], commendations: [], landed: [] };

  const pusher = pusherOf(push);
  if (checks.landing) {
    const scope = { push, weight, knownShas, config: checks.config, readings: checks.readings, pusher, trunk };
    return judgeLanding(checks.changes, checks.landing, scope);
  }
  return judgeWork(checks, { push, weight, knownShas, pusher, trunk });
}

/** What the landing merge wrote inside files both sides changed, where their text was read (D-25). */
function resolvedIn(checks: ChecksFacts): { resolved?: { merge: string; paths: string[] } } {
  const landing = checks.landing;
  if (!landing?.contents) return {};
  return { resolved: { merge: landing.merge, paths: writtenInResolution(landing, landing.contents) } };
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
