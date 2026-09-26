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
import { DEFAULT_CHECKS, isGitHubUiCommit, type CheckConfigMap, type NormalizedPush, type RuleConfigMap, type Watcher } from "@commander/shared";
import { RECONCILE_LOOKBACK_MS } from "@/config/constants.js";
import { wanted } from "@/domain/checks/judge.js";
import { pushChanges, pushSpan } from "@/domain/judgement/changes.js";
import { admitPush, judgePush, type ChecksFacts } from "@/domain/judgement/judgement.js";
import { landingMerge, type LandingSides } from "@/domain/judgement/landing.js";
import { headOf, pullFact, type PullFact } from "@/domain/judgement/event.js";
import { mergeWithDefaults } from "@/domain/violations/engine.js";
import { toCommitDetail, toCommitListEntry, toCommitPull } from "@/integrations/github/commit.mapper.js";
import { isBranchRef, normalizePush } from "@/modules/webhook/push.mapper.js";
import { enrichWith } from "@/queue/push.detail.js";
import type { CommitListEntry } from "@/integrations/github/commits.client.js";
import { branchesToReconcile, recoveredPush, type BranchRead } from "@/queue/reconciler.mapper.js";
import { Contents, type Listed } from "./contents.test.kit.js";
import { GitHubView } from "./github.test.kit.js";
import { REPOSITORY, Story, type PushEvent, type ReconcileEvent, type RemoteEvent } from "./story.test.kit.js";

export interface Front {
  /** Watched branches. Empty is every branch — the shipped default. */
  watch: string[];
  /** Branches marked guarded or critical. With none, the main line is the default branch alone. */
  watchers: Watcher[];
  /** Whether the GitHub App is installed, which every enrichment needs. */
  app: boolean;
  rules: RuleConfigMap;
  /** The measurement limits: the shipped ones unless a scenario says otherwise. */
  checks: CheckConfigMap;
}

/**
 * The shipped rule defaults, with `large_diff` switched on at its shipped
 * threshold: it is off by default, and a pull request landing is precisely where
 * it misfires once someone turns it on.
 */
export const SUITE_RULES: RuleConfigMap = mergeWithDefaults({ large_diff: { enabled: true, threshold: 40 } });

const DEFAULT_FRONT: Front = { watch: [], watchers: [], app: true, rules: SUITE_RULES, checks: DEFAULT_CHECKS };
const TIMEZONE_OFFSET = 3;
/** reconciler.ts `computeSince` — the minute of overlap against clock skew. */
const OVERLAP_MS = 60_000;

export type Outcome = "judged" | "ignored" | "unwatched" | "skipped" | "lost";

/** What happened to the last event of a story, who was charged with what, and who was credited. */
export interface Verdict {
  outcome: Outcome;
  /** `rule@login`, sorted. The login is the one the ledger would write. */
  charges: string[];
  /**
   * `metric@login`, sorted: what someone was credited with for bringing a file
   * back under its limit. Half the record — a reference that only reads the
   * charges cannot say whether whoever fixed something was rewarded for it.
   */
  credits: string[];
}

export const charged = (...charges: string[]): Verdict => ({ outcome: "judged", charges: [...charges].sort(), credits: [] });
/** A verdict that also credits someone: `credited(CLEAN, "file_lines@sara")`. */
export const credited = (verdict: Verdict, ...credits: string[]): Verdict => ({ ...verdict, credits: [...credits].sort() });
export const CLEAN: Verdict = charged();
export const IGNORED: Verdict = { outcome: "ignored", charges: [], credits: [] };
export const UNWATCHED: Verdict = { outcome: "unwatched", charges: [], credits: [] };
export const SKIPPED: Verdict = { outcome: "skipped", charges: [], credits: [] };
const LOST: Verdict = { outcome: "lost", charges: [], credits: [] };

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

/** Every branch's head by name, as GitHub held them at the event being handled. */
type Heads = ReadonlyMap<string, string>;

interface Run {
  story: Story;
  view: GitHubView;
  front: Front;
  /** commit_records: sha → committedAt (ms), as `recordCommits` would write it. */
  known: Map<string, number>;
  contents: Contents;
}

/** Plays a scenario on a fresh repository and returns its last verdict, with the trail. */
export async function play(scenario: Scenario): Promise<{ verdict: Verdict; trail: string[] }> {
  const story = await Story.open();
  try {
    await scenario.story(story);
    if (story.events.length === 0) throw new Error(`${scenario.id}: the story emits no event`);

    const front = { ...DEFAULT_FRONT, ...scenario.front };
    const run: Run = { story, view: new GitHubView(story.git, story.pulls), front, known: new Map(), contents: new Contents(story.git) };
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
  if (event.kind === "reconcile") return reconcile(run, event);
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

  const knownShas = new Set(run.known.keys());
  const facts = {
    push,
    knownShas,
    pull: readPull(run, push),
    rules: run.front.rules,
    timezoneOffset: TIMEZONE_OFFSET,
    watchers: run.front.watchers,
    checks: await readChanges(run, push, knownShas),
    silentWhenClean: false,
    hasChannel: true,
  };
  const judgement = judgePush(facts, (id, error) => {
    throw new Error(`rule ${id} threw`, { cause: error });
  });

  if (judgement.recorded) remember(run.known, push);
  const named = (entries: { ruleId: string; login: string }[]) => entries.map((entry) => `${entry.ruleId}@${entry.login}`);
  return credited(charged(...named(judgement.violations)), ...named(judgement.commendations));
}

/** push.enrich.ts `readPull`: asked only of a head GitHub committed, only with the App — and off the default branch, of its closed pull requests too. */
function readPull(run: Run, push: NormalizedPush): PullFact {
  const head = headOf(push);
  if (!head || !isGitHubUiCommit(head)) return { status: "unasked" };
  if (!run.front.app) return { status: "unknown" };

  const found = pullFact(run.view.pulls(head.sha).map(toCommitPull), head.sha);
  if (found.status !== "none" || push.branch === push.defaultBranch) return found;
  return pullFact(run.view.closedPulls(push.branch).map(toCommitPull), head.sha);
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
 * reconciler.ts `reconcileRepo`, from the branch list to one recovered push per
 * branch — which it queues, so each is handled exactly as a live push is.
 */
async function reconcile(run: Run, event: ReconcileEvent): Promise<Verdict> {
  const existing = [...event.remote.keys()];
  const reads = branchesToReconcile({ watch: run.front.watch, existing, defaultBranch: "main" });
  const since = cursor(run, event.clock);
  const found: Verdict[] = [];

  for (const read of reads) {
    // reconcileBranch — drop what is on record.
    const fresh = (await missed(run, { read, since, remote: event.remote })).filter((entry) => !run.known.has(entry.sha));
    const push = recoveredPush({ fullName: REPOSITORY, defaultBranch: "main" }, read.branch, fresh);
    if (push) found.push(await handle(run, push));
  }
  return credited(charged(...found.flatMap((verdict) => verdict.charges)), ...found.flatMap((verdict) => verdict.credits));
}

/** reconciler.read.ts `readMissed`, oldest first: the default branch by its history, any other beyond it. */
async function missed(run: Run, at: { read: BranchRead; since: number; remote: Heads }): Promise<CommitListEntry[]> {
  const { read, since, remote } = at;
  const head = remote.get(read.branch);
  if (!head) return [];
  if (read.beyond === null) return (await run.view.list(head, since)).map(toCommitListEntry).reverse();

  const base = remote.get(read.beyond);
  if (!base) return [];
  const { commits } = await run.view.compare(base, head);
  return commits.map(toCommitListEntry).filter((entry) => Date.parse(entry.timestamp) >= since);
}

/**
 * delivery.checks.ts `readChanges`: the push's own tree before against after,
 * both sides measured — and a landing's other side besides. The worker resolves
 * each commit to its tree first; git reads a commit's tree directly, which is
 * the same listing.
 */
async function readChanges(run: Run, push: NormalizedPush, knownShas: ReadonlySet<string>): Promise<ChecksFacts> {
  const config = run.front.checks;
  const span = run.front.app ? pushSpan(push) : null;
  if (!span) return { config, changes: [], readings: new Map() };

  const [before, after] = await Promise.all([run.contents.tree(span.base), run.contents.tree(span.head)]);
  const landing = await readLanding(run, { push, knownShas, before, after });
  const changes = pushChanges({ before, after, push }).filter((file) => wanted(config, file.path));
  const branch = (landing?.branch ?? []).filter((file) => wanted(config, file.path));
  const blobs = [...changes, ...branch].flatMap((file) => [file, ...(file.previousSha ? [{ path: file.path, sha: file.previousSha }] : [])]);
  const readings = await run.contents.measure(blobs);
  return { config, changes, readings, ...(landing && { landing: { ...landing, branch } }) };
}

/** delivery.checks.ts `readLanding`: the fork from the compare API, then its listing and the branch head's. */
async function readLanding(run: Run, input: { push: NormalizedPush; knownShas: ReadonlySet<string>; before: Listed[]; after: Listed[] }): Promise<LandingSides | null> {
  const landing = landingMerge({ push: input.push, knownShas: input.knownShas });
  if (!landing) return null;

  const { merge_base_commit: fork } = await run.view.compare(landing.first, landing.second);
  const [second, forked] = await Promise.all([run.contents.tree(landing.second), run.contents.tree(fork.sha)]);
  const blobs = (listing: Listed[]) => new Map(listing.map((entry) => [entry.path, entry.sha]));
  const branch = pushChanges({ before: forked, after: second, push: input.push });
  return { merge: landing.merge, branch, first: blobs(input.before), fork: blobs(forked), second: blobs(second), merged: blobs(input.after) };
}

/** reconciler.ts `computeSince`. */
function cursor(run: Run, now: number): number {
  const floor = now - RECONCILE_LOOKBACK_MS;
  const newest = Math.max(floor, ...run.known.values());
  return Math.max(newest - OVERLAP_MS, floor);
}

function describeEvent(event: RemoteEvent): string {
  if (event.kind === "reconcile") return "reconciler pass";
  const range = `${event.before.slice(0, 7)}..${event.after.slice(0, 7)}`;
  return `${event.sender.login} → ${event.ref} ${range}${event.lost ? " (webhook lost)" : ""}`;
}

export function format(verdict: Verdict): string {
  const credits = verdict.credits.length > 0 ? ` credits [${verdict.credits.join(", ")}]` : "";
  return `${verdict.outcome} [${verdict.charges.join(", ")}]${credits}`;
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
    assert.deepEqual(scenario.expect.credits, [...scenario.expect.credits].sort(), `${scenario.id}: add credits with credited()`);
    if (scenario.defect) {
      assert.notDeepEqual(scenario.defect.observed, scenario.expect, `${scenario.id}: a defect that equals its expectation is not a defect`);
    }
  }
}
