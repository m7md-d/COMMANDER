/**
 * Who answers for what a push holds (0009 §4).
 *
 * Whoever pushed answers for what the push did; whoever wrote a commit answers
 * for what the commit holds. Every finding leaves here naming one person or
 * naming nobody, and a finding that names nobody is charged to nobody. The
 * alternative — charging whoever is at hand — is how a merge came to answer for
 * the branch it closed, and a maintainer for the commits of whoever they pushed
 * for (scenarios in `attribution.test.ts`).
 */

import type {
  Commendation,
  Finding,
  NormalizedCommit,
  NormalizedPush,
  PushWeight,
  RuleConfigMap,
  ViolationHit,
} from "@commander/shared";
import { evaluateRules, type RuleErrorReporter } from "@/domain/violations/engine.js";

/** A finding, and who the evidence names to answer for it — null when it names nobody. */
export interface Named extends Finding {
  login: string | null;
}

/** Whoever pushed. Nobody, on a push the reconciler rebuilt: git records who wrote, never who pushed. */
export function pusherOf(push: NormalizedPush): string | null {
  return push.recovered ? null : push.actorLogin || null;
}

/** Nobody, when GitHub could tie the author's address to no account. */
const authorOf = (commit: NormalizedCommit): string | null => commit.authorLogin || null;

export interface RuleFacts {
  push: NormalizedPush;
  weight: PushWeight;
  knownShas: ReadonlySet<string>;
  rules: RuleConfigMap;
  timezoneOffset: number;
}

/**
 * The rules, each finding naming who answers for it. The pusher's rules read the
 * push. Each author's rules read that author's commits the record has not judged
 * yet, so a commit is judged once — when it first arrives, on whatever branch —
 * and a merge that carries it later charges nobody for it again.
 */
export function judgeRules(facts: RuleFacts, onRuleError: RuleErrorReporter): Named[] {
  const { push, weight, rules, timezoneOffset } = facts;
  const pusher = pusherOf(push);
  const pushed = { push, timezoneOffset, weight, commits: push.commits };
  const named: Named[] = evaluateRules({ context: pushed, rules, answerer: "pusher" }, onRuleError).map(
    (finding) => ({ ...finding, login: pusher }),
  );

  const unjudged = push.commits.filter((commit) => !facts.knownShas.has(commit.sha));
  for (const [author, commits] of byAuthor(unjudged)) {
    const written = { push, timezoneOffset, weight, commits };
    const found = evaluateRules({ context: written, rules, answerer: "author" }, onRuleError);
    named.push(...found.map((finding) => ({ ...finding, login: author })));
  }
  return named;
}

/** Commits by author, each author where they first appear; the authorless together, under nobody. */
function byAuthor(commits: NormalizedCommit[]): Map<string | null, NormalizedCommit[]> {
  const groups = new Map<string | null, NormalizedCommit[]>();
  for (const commit of commits) {
    const author = authorOf(commit);
    groups.set(author, [...(groups.get(author) ?? []), commit]);
  }
  return groups;
}

/**
 * Whose work changed each path the checks may judge: the author of the one
 * unjudged commit — or merge residue — that touched it. A path two people
 * changed in one push names nobody: the crossing is measured between the push's
 * two ends, and which of them made it would take a measurement per commit.
 */
export function handsOnPaths(push: NormalizedPush, weight: PushWeight): Map<string, string | null> {
  const author = new Map(push.commits.map((commit) => [commit.sha, authorOf(commit)]));
  const hands = new Map<string, Set<string | null>>();
  for (const entry of weight.work) {
    for (const path of entry.paths) {
      hands.set(path, (hands.get(path) ?? new Set<string | null>()).add(author.get(entry.sha) ?? null));
    }
  }
  return new Map([...hands].map(([path, set]) => [path, set.size === 1 ? ([...set][0] ?? null) : null]));
}

/** The findings someone answers for, as the record holds them. */
export function answered(entries: Named[]): (ViolationHit & Commendation)[] {
  return entries.flatMap(({ ruleId, detail, login }) => (login === null ? [] : [{ ruleId, detail, login }]));
}

/**
 * The member a commit is filed under: its author — or, when GitHub could tie
 * the author's address to no account, whoever delivered it, as every commit was
 * filed before. A filing, never a charge.
 */
export function filedUnder(commit: NormalizedCommit, push: NormalizedPush): string {
  return commit.authorLogin || push.actorLogin;
}

/** Commits new to the record, counted by the member each is filed under. */
export function newCommitsBy(push: NormalizedPush, knownShas: ReadonlySet<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const commit of push.commits) {
    if (knownShas.has(commit.sha)) continue;
    const login = filedUnder(commit, push);
    counts.set(login, (counts.get(login) ?? 0) + 1);
  }
  return counts;
}
