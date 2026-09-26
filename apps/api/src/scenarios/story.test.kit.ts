/**
 * GitHub's side of a story: which branch heads it holds, every push it
 * receives, and the three buttons on a pull request.
 *
 * The remote is a map of branch heads rather than a second repository. Every
 * object is already in the one local repository; what a push event needs from
 * GitHub is only which heads it held *at the moment of the push* — which is what
 * decides `before`, `created`, `forced` and `distinct` in the payload.
 */

import {
  Git,
  LINA,
  WEB_FLOW,
  type Change,
  type CommitSpec,
  type MergeSpec,
  type Person,
} from "./git.test.kit.js";

export const ZERO = "0".repeat(40);
export const REPOSITORY = "team/repo";

export interface PushEvent {
  kind: "push";
  ref: string;
  before: string;
  after: string;
  sender: Person;
  /** Every branch head GitHub held just before this push, this branch's included. */
  heads: string[];
  /** Every branch by name, as it stood just after this push. The reference plays
   *  the events once the story is over, so anything read while handling one must
   *  be read from here — the story's own `remote` is where things ended up. */
  remote: ReadonlyMap<string, string>;
  /** The webhook never arrived — the server was down. Only the reconciler can see it. */
  lost: boolean;
}

export interface ReconcileEvent {
  kind: "reconcile";
  remote: ReadonlyMap<string, string>;
  /** The story's clock when the pass ran: its "now". */
  clock: number;
}

export type RemoteEvent = PushEvent | ReconcileEvent;

export type MergeStyle = "merge" | "squash" | "rebase";

/** A pull request GitHub merged, as its API lists it against a commit. */
export interface MergedPull {
  number: number;
  base: string;
  /** The pull request's branch head when it was merged. */
  head: string;
  /** What the merge made: the merge commit, the squash, or the rebase's last commit. */
  mergeCommit: string;
}

export interface PullRequest {
  number: number;
  head: string;
  base: string;
  /** Who opened it — the author GitHub gives a squash commit. */
  author: Person;
  /** Who pressed the button — the sender of the push that follows. */
  by: Person;
  style: MergeStyle;
  title?: string;
  lost?: boolean;
  /** When the button was pressed (ISO), for the rules that read the clock. */
  at?: string;
}

export class Story {
  readonly remote = new Map<string, string>();
  readonly events: RemoteEvent[] = [];
  /** Every pull request the story merged through GitHub's button. */
  readonly pulls: MergedPull[] = [];

  private constructor(readonly git: Git) {}

  static async open(): Promise<Story> {
    return new Story(await Git.open());
  }

  close(): Promise<void> {
    return this.git.close();
  }

  commit(spec: CommitSpec): Promise<string> {
    return this.git.commit(spec);
  }

  merge(spec: MergeSpec): Promise<string> {
    return this.git.merge(spec);
  }

  branch(name: string, from: string): Promise<void> {
    return this.git.createBranch(name, from);
  }

  /** `git push`, or `git push origin <branch>:<to>` when `to` is given. */
  async push(branch: string, by: Person, options: { to?: string; lost?: boolean } = {}) {
    const target = options.to ?? branch;
    const after = await this.git.resolve(branch);
    this.record({ ref: `refs/heads/${target}`, after, sender: by, lost: options.lost ?? false }, target);
    this.remote.set(target, after);
  }

  deleteBranch(branch: string, by: Person): void {
    this.record({ ref: `refs/heads/${branch}`, after: ZERO, sender: by, lost: false }, branch);
    this.remote.delete(branch);
  }

  async pushTag(tag: string, by: Person): Promise<void> {
    const after = await this.git.resolve("HEAD");
    this.events.push({
      kind: "push",
      ref: `refs/tags/${tag}`,
      before: ZERO,
      after,
      sender: by,
      heads: [...this.remote.values()],
      remote: new Map(this.remote),
      lost: false,
    });
  }

  /** The reconciler's periodic pass, which is the only thing that sees a lost push. */
  reconcile(): void {
    this.events.push({ kind: "reconcile", remote: new Map(this.remote), clock: this.git.clock });
  }

  /** The green button, in each of its three styles, then the push GitHub sends. */
  async mergePullRequest(pr: PullRequest): Promise<void> {
    const title = pr.title ?? `Deliver ${pr.head}`;
    const head = await this.git.resolve(pr.head);

    if (pr.style === "merge") {
      const message = `Merge pull request #${pr.number} from ${REPOSITORY.split("/")[0]}/${pr.head}\n\n${title}`;
      const at = pr.at !== undefined && { at: pr.at };
      await this.git.merge({ into: pr.base, from: pr.head, by: pr.by, committer: WEB_FLOW, message, ...at });
    } else if (pr.style === "squash") {
      const message = `${title} (#${pr.number})`;
      await this.git.squash({ into: pr.base, from: pr.head, by: pr.author, committer: WEB_FLOW, message });
    } else {
      const shas = await this.git.between(pr.base, pr.head);
      await this.git.cherryPick({ onto: pr.base, shas, committer: WEB_FLOW });
    }

    this.pulls.push({ number: pr.number, base: pr.base, head, mergeCommit: await this.git.resolve(pr.base) });
    await this.push(pr.base, pr.by, { lost: pr.lost ?? false });
  }

  /** "Update branch" on a pull request: the base merged into the head, by GitHub. */
  async updateBranch(spec: { head: string; base: string; by: Person }): Promise<void> {
    const message = `Merge branch '${spec.base}' into ${spec.head}`;
    await this.git.merge({ into: spec.head, from: spec.base, by: spec.by, committer: WEB_FLOW, message });
    await this.push(spec.head, spec.by);
  }

  /** The pencil icon: a file edited in the browser and committed straight to a branch. */
  async editOnGitHub(spec: { on: string; by: Person; title: string; lost?: boolean } & Change): Promise<void> {
    const { lost, ...edit } = spec;
    await this.git.commit({ ...edit, committer: WEB_FLOW });
    await this.push(spec.on, spec.by, { lost: lost ?? false });
  }

  private record(event: Omit<PushEvent, "kind" | "before" | "heads" | "remote">, branch: string): void {
    const remote = new Map(this.remote);
    if (event.after === ZERO) remote.delete(branch);
    else remote.set(branch, event.after);

    this.events.push({
      kind: "push",
      ...event,
      before: this.remote.get(branch) ?? ZERO,
      heads: [...this.remote.values()],
      remote,
    });
  }
}

/** `count` modules under `dir`, numbered from `from` and zero-padded so a path
 *  sort is a numeric sort. `stamp` makes each write a real change. */
export function modules(spec: { dir: string; count: number; stamp: string; from?: number }) {
  const files: Record<string, string> = {};
  const from = spec.from ?? 0;
  for (let k = from; k < from + spec.count; k += 1) {
    files[`${spec.dir}/m${String(k).padStart(3, "0")}.ts`] = `export const part${k} = "${spec.stamp}";\n`;
  }
  return files;
}

/** The project every story starts from: twelve modules on main, pushed by Lina. */
export async function seed(story: Story): Promise<void> {
  const write = modules({ dir: "src/core", count: 12, stamp: "seed" });
  await story.commit({ on: "main", by: LINA, title: "Lay out the ledger service", write });
  await story.push("main", LINA);
}

export interface WorkSpec {
  on: string;
  by: Person;
  commits: number;
  /** Modules each commit touches. Consecutive commits overlap by about a third,
   *  so the per-commit sum is larger than the set of files — as in real work. */
  width: number;
  dir?: string;
  /** Titles by position; the rest get an ordinary descriptive one. */
  titles?: string[];
  at?: string;
}

export function work(story: Story, spec: WorkSpec): Promise<string[]> {
  const stride = Math.max(1, Math.ceil(spec.width * 0.7));
  const dir = spec.dir ?? `src/${spec.on.replace(/[^a-z0-9]+/gi, "-")}`;

  const commits = Array.from({ length: spec.commits }, (_, i): CommitSpec => {
    const title = spec.titles?.[i] ?? `Build step ${i + 1} of ${spec.on}`;
    const write = modules({ dir, from: i * stride, count: spec.width, stamp: `${spec.on}-${i}` });
    // Only the first commit is pinned; the clock carries on from it, so a run
    // that starts at night stays at night.
    const at = i === 0 ? spec.at : undefined;
    return { on: spec.on, by: spec.by, title, write, ...(at !== undefined && { at }) };
  });
  return story.git.commits(commits);
}
