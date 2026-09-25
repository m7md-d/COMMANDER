/**
 * From "GitHub sent this" to "these people were charged with this", on the
 * production code itself: the payload mapper, the enrichment, the weighing and
 * the rules are the real functions. Only the *order* they are called in is
 * written here — mirroring `delivery.processor.ts` and `reconciler.ts`, and each
 * mirrored step says which. When one of those files changes its order or its
 * gates, this file is the one that has to follow.
 *
 * No model is called, anywhere. A verdict here is arithmetic on a repository.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  branchIsWatched,
  weighPush,
  type NormalizedPush,
  type RuleConfigMap,
} from "@commander/shared";
import { evaluateRules, mergeWithDefaults } from "@/domain/violations/engine.js";
import { toCommitDetail, toCommitListEntry } from "@/integrations/github/commit.mapper.js";
import { isBranchRef, normalizePush } from "@/modules/webhook/push.mapper.js";
import { enrichWith } from "@/queue/push.detail.js";
import { buildSyntheticPushes } from "@/queue/reconciler.mapper.js";
import { GitHubView } from "./github.test.kit.js";
import { REPOSITORY, Story, type PushEvent, type RemoteEvent } from "./story.test.kit.js";

export interface Front {
  /** Watched branches. Empty is every branch — the shipped default. */
  watch: string[];
  /** Whether the GitHub App is installed, which every enrichment needs. */
  app: boolean;
  rules: RuleConfigMap;
}

/**
 * The shipped rule defaults, with `large_diff` switched on at its shipped
 * threshold: it is off by default, and a pull request landing is precisely where
 * it misfires once someone turns it on.
 */
export const SUITE_RULES: RuleConfigMap = mergeWithDefaults({ large_diff: { enabled: true, threshold: 40 } });

const DEFAULT_FRONT: Front = { watch: [], app: true, rules: SUITE_RULES };
const TIMEZONE_OFFSET = 3;
/** reconciler.ts — `RECONCILE_LOOKBACK_MS` and the minute of overlap. */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1_000;
const OVERLAP_MS = 60_000;

export type Outcome = "judged" | "ignored" | "unwatched" | "skipped" | "lost";

/** What happened to the last event of a story, and who was charged with what. */
export interface Verdict {
  outcome: Outcome;
  /** `rule@login`, sorted. The login is the one the ledger would write. */
  charges: string[];
}

export const charged = (...charges: string[]): Verdict => ({ outcome: "judged", charges: [...charges].sort() });
export const CLEAN: Verdict = charged();
export const IGNORED: Verdict = { outcome: "ignored", charges: [] };
export const UNWATCHED: Verdict = { outcome: "unwatched", charges: [] };
export const SKIPPED: Verdict = { outcome: "skipped", charges: [] };
const LOST: Verdict = { outcome: "lost", charges: [] };

export interface Scenario {
  /** Stable, kebab-case: the name a failure and a defect record are filed under. */
  id: string;
  title: string;
  front?: Partial<Front>;
  /** Builds the history. The verdict under test is the one on its *last* event. */
  story: (story: Story) => Promise<void>;
  /** What a reviewer worth trusting would conclude. The policy, not the current output. */
  expect: Verdict;
  /** What the code concludes today, when that is not `expect` — and why. */
  defect?: { observed: Verdict; because: string };
}

interface Run {
  story: Story;
  view: GitHubView;
  front: Front;
  /** commit_records: sha → committedAt (ms), as `recordCommits` would write it. */
  known: Map<string, number>;
}

/** Plays a scenario on a fresh repository and returns its last verdict, with the trail. */
export async function play(scenario: Scenario): Promise<{ verdict: Verdict; trail: string[] }> {
  const story = await Story.open();
  try {
    await scenario.story(story);
    if (story.events.length === 0) throw new Error(`${scenario.id}: the story emits no event`);

    const run: Run = { story, view: new GitHubView(story.git), front: { ...DEFAULT_FRONT, ...scenario.front }, known: new Map() };
    const trail: string[] = [];
    let verdict = CLEAN;
    for (const event of story.events) {
      verdict = await judge(run, event);
      trail.push(`${describeEvent(event)} → ${format(verdict)}`);
    }
    return { verdict, trail };
  } finally {
    await story.close();
  }
}

function judge(run: Run, event: RemoteEvent): Promise<Verdict> {
  if (event.kind === "reconcile") return reconcile(run);
  if (event.lost) return Promise.resolve(LOST);
  return receive(run, event);
}

async function receive(run: Run, event: PushEvent): Promise<Verdict> {
  const payload = await run.view.webhook(event);
  // webhook.controller.ts — tag pushes arrive as pushes and are dropped.
  if (!isBranchRef(payload.ref)) return IGNORED;

  const push = normalizePush(payload);
  // delivery.processor.ts — the branch gate, then the empty-push gate.
  if (!branchIsWatched(run.front.watch, push.branch)) return UNWATCHED;
  if (push.commits.length === 0 && !push.deleted) return SKIPPED;

  return { outcome: "judged", charges: await charge(run, push) };
}

/**
 * delivery.processor.ts `run` from enrichment on: enrich, weigh against what is
 * on record, evaluate, record. Recording always follows here because this front
 * is neither silent nor without a channel — the two gates in `run` that stop a
 * judged push from ever being written down.
 */
async function charge(run: Run, received: NormalizedPush): Promise<string[]> {
  const push = run.front.app
    ? (await enrichWith(received, async (sha) => ({ ok: true, data: toCommitDetail(await run.view.commit(sha)) }))).push
    : received;

  const weight = weighPush({ push, knownShas: new Set(run.known.keys()) });
  const hits = evaluateRules({ push, timezoneOffset: TIMEZONE_OFFSET, weight }, run.front.rules, (id, error) => {
    throw new Error(`rule ${id} threw`, { cause: error });
  });

  remember(run.known, push);
  // delivery.ledger.ts — every entry is written against the push's actor.
  return hits.map((hit) => `${hit.ruleId}@${push.actorLogin}`).sort();
}

/** dossier.ledger.ts `recordCommits`: first write wins, unparseable dates are skipped. */
function remember(known: Map<string, number>, push: NormalizedPush): void {
  for (const commit of push.commits) {
    const at = Date.parse(commit.timestamp);
    if (!commit.sha || Number.isNaN(at) || known.has(commit.sha)) continue;
    known.set(commit.sha, at);
  }
}

/** reconciler.ts `reconcileRepo`, from the branch list to the synthetic pushes. */
async function reconcile(run: Run): Promise<Verdict> {
  const concrete = run.front.watch.filter((branch) => branch.length > 0 && !branch.includes("*"));
  const branches = concrete.length > 0 ? concrete : ["main"];
  const since = cursor(run);
  const charges: string[] = [];

  for (const branch of branches) {
    const head = run.story.remote.get(branch);
    if (!head) continue;
    const listed = (await run.view.list(head, since)).map(toCommitListEntry);
    // reconcileBranch — drop what is on record, then oldest first.
    const fresh = listed.filter((entry) => !run.known.has(entry.sha)).reverse();
    for (const push of buildSyntheticPushes({ fullName: REPOSITORY }, branch, fresh)) {
      charges.push(...(await charge(run, push)));
    }
  }
  return { outcome: "judged", charges: charges.sort() };
}

/** reconciler.ts `computeSince`. */
function cursor(run: Run): number {
  const floor = run.story.git.clock - LOOKBACK_MS;
  const newest = Math.max(floor, ...run.known.values());
  return Math.max(newest - OVERLAP_MS, floor);
}

function describeEvent(event: RemoteEvent): string {
  if (event.kind === "reconcile") return "reconciler pass";
  const range = `${event.before.slice(0, 7)}..${event.after.slice(0, 7)}`;
  return `${event.sender.login} → ${event.ref} ${range}${event.lost ? " (webhook lost)" : ""}`;
}

export function format(verdict: Verdict): string {
  return `${verdict.outcome} [${verdict.charges.join(", ")}]`;
}

/**
 * Registers a catalog. A scenario with no defect must produce `expect`. One with
 * a defect must produce exactly `defect.observed` — and fails the moment it
 * produces `expect` instead, because a fixed defect left on file makes the
 * reference lie about the code.
 */
export function runCatalog(name: string, scenarios: Scenario[]): void {
  describe(name, { concurrency: 4 }, () => {
    it("the catalog is well-formed", () => assertWellFormed(scenarios));
    for (const scenario of scenarios) {
      const label = `${scenario.id}: ${scenario.title}${scenario.defect ? " [known defect]" : ""}`;
      it(label, () => check(scenario));
    }
  });
}

async function check(scenario: Scenario): Promise<void> {
  const { verdict, trail } = await play(scenario);
  const context = `\n  trail:\n    ${trail.join("\n    ")}`;
  const { defect } = scenario;

  if (!defect) {
    assert.deepEqual(verdict, scenario.expect, `${scenario.id}: expected ${format(scenario.expect)}, got ${format(verdict)}. If the new verdict is right, the policy changed — update \`expect\` and say why. If not, this is a regression.${context}`);
    return;
  }

  assert.notDeepEqual(verdict, scenario.expect, `${scenario.id} now produces its expected verdict ${format(scenario.expect)}. Delete its \`defect\` record: the reference must state what the code does now.${context}`);
  assert.deepEqual(verdict, defect.observed, `${scenario.id} was recorded as ${format(defect.observed)} and now yields ${format(verdict)} — still not ${format(scenario.expect)}. If this is progress, update \`defect.observed\`; if not, it is a regression.${context}`);
}

function assertWellFormed(scenarios: Scenario[]): void {
  const ids = scenarios.map((scenario) => scenario.id);
  const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(duplicated, [], "scenario ids must be unique within a catalog");

  for (const scenario of scenarios) {
    assert.match(scenario.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${scenario.id}: ids are kebab-case`);
    assert.deepEqual(scenario.expect.charges, [...scenario.expect.charges].sort(), `${scenario.id}: build verdicts with charged()`);
    if (scenario.defect) {
      assert.notDeepEqual(scenario.defect.observed, scenario.expect, `${scenario.id}: a defect that equals its expectation is not a defect`);
    }
  }
}
