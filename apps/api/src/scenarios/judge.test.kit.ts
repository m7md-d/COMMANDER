/**
 * From "GitHub sent this" to "these people were charged with this", on the
 * production code itself. The payload mapper, the enrichment and the decision —
 * `admitPush` and `judgePush`, the functions the processor calls — are the real
 * ones. What is written here is only the I/O around them, each step naming the
 * file it follows: what GitHub is asked, what the record keeps, what the
 * reconciler replays. A gate, a charge or an attribution is never written here,
 * so a change to one reaches this reference on its own.
 *
 * No model is called, anywhere. A verdict here is arithmetic on a repository.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NormalizedPush, RuleConfigMap } from "@commander/shared";
import { RECONCILE_LOOKBACK_MS } from "@/config/constants.js";
import { admitPush, judgePush } from "@/domain/judgement/judgement.js";
import { mergeWithDefaults } from "@/domain/violations/engine.js";
import { toCommitDetail, toCommitListEntry } from "@/integrations/github/commit.mapper.js";
import { isBranchRef, normalizePush } from "@/modules/webhook/push.mapper.js";
import { enrichWith } from "@/queue/push.detail.js";
import type { CommitListEntry } from "@/integrations/github/commits.client.js";
import { branchesToReconcile, buildSyntheticPushes, type BranchRead } from "@/queue/reconciler.mapper.js";
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
/** reconciler.ts `computeSince` — the minute of overlap against clock skew. */
const OVERLAP_MS = 60_000;
/** The checks measure the stored tree, which the reference does not model. */
const NO_CHECKS = { violations: [], commendations: [] };

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
  return handle(run, normalizePush(payload));
}

/**
 * delivery.processor.ts `run`: admit, enrich, read what is on record, judge,
 * record. This front is never silent and always has a channel; what the
 * judgement then says about recording is taken as it says it.
 */
async function handle(run: Run, received: NormalizedPush): Promise<Verdict> {
  const admission = admitPush({ repository: { enabled: true, branches: run.front.watch }, push: received });
  if (!admission.read) return UNWATCHED;
  if (!admission.judged) return SKIPPED;

  const push = run.front.app
    ? (await enrichWith(received, async (sha) => ({ ok: true, data: toCommitDetail(await run.view.commit(sha)) }))).push
    : received;

  const facts = {
    push,
    knownShas: new Set(run.known.keys()),
    rules: run.front.rules,
    timezoneOffset: TIMEZONE_OFFSET,
    checks: NO_CHECKS,
    silentWhenClean: false,
    hasChannel: true,
  };
  const judgement = judgePush(facts, (id, error) => {
    throw new Error(`rule ${id} threw`, { cause: error });
  });

  if (judgement.recorded) remember(run.known, push);
  return charged(...judgement.violations.map((hit) => `${hit.ruleId}@${judgement.login}`));
}

/** dossier.ledger.ts `recordCommits`: first write wins, unparseable dates are skipped. */
function remember(known: Map<string, number>, push: NormalizedPush): void {
  for (const commit of push.commits) {
    const at = Date.parse(commit.timestamp);
    if (!commit.sha || Number.isNaN(at) || known.has(commit.sha)) continue;
    known.set(commit.sha, at);
  }
}

/**
 * reconciler.ts `reconcileRepo`, from the branch list to the synthetic pushes —
 * which it queues, so each is handled exactly as a live push is.
 */
async function reconcile(run: Run): Promise<Verdict> {
  const existing = [...run.story.remote.keys()];
  const reads = branchesToReconcile({ watch: run.front.watch, existing, defaultBranch: "main" });
  const since = cursor(run);
  const charges: string[] = [];

  for (const read of reads) {
    // reconcileBranch — drop what is on record.
    const fresh = (await missed(run, read, since)).filter((entry) => !run.known.has(entry.sha));
    for (const push of buildSyntheticPushes({ fullName: REPOSITORY }, read.branch, fresh)) {
      charges.push(...(await handle(run, push)).charges);
    }
  }
  return { outcome: "judged", charges: charges.sort() };
}

/** reconciler.read.ts `readMissed`, oldest first: the default branch by its history, any other beyond it. */
async function missed(run: Run, read: BranchRead, since: number): Promise<CommitListEntry[]> {
  const head = run.story.remote.get(read.branch);
  if (!head) return [];
  if (read.beyond === null) return (await run.view.list(head, since)).map(toCommitListEntry).reverse();

  const base = run.story.remote.get(read.beyond);
  if (!base) return [];
  const { commits } = await run.view.compare(base, head);
  return commits.map(toCommitListEntry).filter((entry) => Date.parse(entry.timestamp) >= since);
}

/** reconciler.ts `computeSince`. */
function cursor(run: Run): number {
  const floor = run.story.git.clock - RECONCILE_LOOKBACK_MS;
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
