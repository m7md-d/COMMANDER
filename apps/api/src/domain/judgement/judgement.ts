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
  weighPush,
  type Commendation,
  type NormalizedPush,
  type Repository,
  type RuleConfigMap,
  type ViolationHit,
} from "@commander/shared";
import { evaluateRules, type RuleErrorReporter } from "@/domain/violations/engine.js";

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

export interface PushFacts {
  /** The push as enrichment left it. */
  push: NormalizedPush;
  /** Shas already in `commit_records`: the work this repository had seen before. */
  knownShas: ReadonlySet<string>;
  rules: RuleConfigMap;
  timezoneOffset: number;
  /** What the checks measured on the files the push touched. */
  checks: { violations: ViolationHit[]; commendations: Commendation[] };
  silentWhenClean: boolean;
  /** Whether there is a channel to send to at all. */
  hasChannel: boolean;
}

/** Why a judged push is not reported. */
export type Withheld = "clean_and_silent" | "discord_missing";

export type Judgement = {
  /** The rules' charges, then the checks'. */
  violations: ViolationHit[];
  commendations: Commendation[];
  /** Who answers for every charge and every commendation: today, whoever pushed. */
  login: string;
} & (
  // Written to the record — commits, counters, ledger — and then reported.
  | { recorded: true; withheld: null }
  // Neither. Recording is still tied to sending here; 0009 §5 separates them.
  | { recorded: false; withheld: Withheld }
);

export function judgePush(facts: PushFacts, onRuleError: RuleErrorReporter): Judgement {
  const { push } = facts;
  const weight = weighPush({ push, knownShas: facts.knownShas });
  const found = {
    violations: [
      ...evaluateRules({ push, timezoneOffset: facts.timezoneOffset, weight }, facts.rules, onRuleError),
      ...facts.checks.violations,
    ],
    commendations: facts.checks.commendations,
    login: push.actorLogin,
  };

  const withheld = withholding(facts, found.violations.length + found.commendations.length);
  return withheld === null ? { ...found, recorded: true, withheld } : { ...found, recorded: false, withheld };
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
