/**
 * What happened, as opposed to what arrived (0009 §2).
 *
 * A push is a list of commits; the event is how they got there — a pull request
 * landing through GitHub's button, "Update branch", a merge made on a laptop,
 * the pencil in the browser, a plain direct push, a rewrite, a rewind, a
 * deletion. The rules need the event, not the list: a landing is not a batch
 * dumped at once, and a merge made on a laptop is a direct push whatever its
 * message says. A merge is two parents, never a title — matching "Merge…" was
 * typed past by anyone who wanted to, and left out by every squash and rebase.
 */

import { isGitHubUiCommit, isMerge, type NormalizedCommit, type NormalizedPush } from "@commander/shared";

export const PUSH_KINDS = [
  "pr_landing",
  "branch_update",
  "local_merge",
  "web_edit",
  "direct_push",
  "rewrite",
  "rewind",
  "branch_deleted",
  "unknown",
] as const;

export type PushKind = (typeof PUSH_KINDS)[number];

/** A pull request as GitHub lists it against a commit, the fields the event is read from. */
export interface CommitPull {
  number: number;
  merged: boolean;
  /** The commit the merge made — a merge commit, the squash, or the rebase's last. */
  mergeCommit: string | null;
  /** The pull request's branch head when it was merged. */
  head: string;
}

/**
 * Whether a pull request landed the push, as GitHub answers it. Asked only when
 * GitHub itself committed the push's head: every merge button commits as
 * `web-flow`, so a head someone committed themselves was landed by no button.
 */
export type PullFact =
  | { status: "unasked" }
  | { status: "unknown" }
  | { status: "none" }
  | { status: "landed"; number: number; head: string };

/** The merged pull request whose merge made this head, if GitHub lists one. */
export function pullFact(pulls: CommitPull[], head: string): PullFact {
  const landed = pulls.find((pull) => pull.merged && pull.mergeCommit === head);
  return landed ? { status: "landed", number: landed.number, head: landed.head } : { status: "none" };
}

/** The commit a push leaves its branch at. */
export function headOf(push: NormalizedPush): NormalizedCommit | undefined {
  return push.commits.find((commit) => commit.sha === push.after) ?? push.commits.at(-1);
}

/**
 * The event, from the most reliable fact to the weakest: the flags GitHub sets,
 * then who committed the head, then its parents. When GitHub committed the head
 * and could not be asked which button did it, the event is unknown — a landing
 * cannot be told from the pencil — and nothing weighs it.
 */
export function classifyPush(input: { push: NormalizedPush; pull: PullFact }): PushKind {
  const { push, pull } = input;
  if (push.deleted) return "branch_deleted";

  const head = headOf(push);
  if (!head) return push.forced ? "rewind" : "unknown";
  if (isGitHubUiCommit(head)) return madeByGitHub(head, pull);
  if (push.forced) return "rewrite";
  return isMerge(head) ? "local_merge" : "direct_push";
}

function madeByGitHub(head: NormalizedCommit, pull: PullFact): PushKind {
  if (pull.status === "landed") return "pr_landing";
  if (pull.status !== "none" || head.parents === undefined) return "unknown";
  // No pull request made it: a merge GitHub made is "Update branch", anything else the pencil.
  return isMerge(head) ? "branch_update" : "web_edit";
}

/**
 * The events that land work no review saw: what `direct_push` charges, and the
 * only ones the size rules weigh. A pull request's commits were the branch's
 * business, and "Update branch" brings the base's own history back to it.
 */
export function landedUnreviewed(kind: PushKind): boolean {
  return kind === "direct_push" || kind === "local_merge" || kind === "web_edit" || kind === "rewrite";
}

/**
 * The commits already judged, for this push. A squash or a rebase lands a pull
 * request's commits under new shas; when the branch's head was on record, they
 * are its work again — judged when it was pushed — and charging them anew is the
 * same crossing charged twice (scenario `crossing-squash-merged`). A merge-style
 * landing carries the branch's own shas, and its merge commit is its own work.
 */
export function judgedShas(input: { push: NormalizedPush; pull: PullFact; knownShas: ReadonlySet<string> }): ReadonlySet<string> {
  const { push, pull, knownShas } = input;
  const head = headOf(push);
  if (pull.status !== "landed" || !knownShas.has(pull.head) || !head || isMerge(head)) return knownShas;
  return new Set([...knownShas, ...push.commits.map((commit) => commit.sha)]);
}
