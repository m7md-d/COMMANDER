/**
 * Who pushed what the reconciler found (D-22).
 *
 * Git records who wrote and who committed a commit, never who pushed it. GitHub's
 * events timeline does: each push event names its actor and the `before` and
 * `head` it moved the branch between. So a gap on a branch is split among the
 * pushes the timeline shows, each part named by its pusher, and whatever no
 * event accounts for stays one push naming nobody — as every recovered push did
 * before. The timeline lags by up to hours and keeps 300 events, so "not shown"
 * is ordinary, and it is never filled with a guess.
 *
 * Pure, and called as it is by the scenario reference. Asking GitHub for the
 * events and for each one's commits is `reconciler.read.ts`.
 */

import type { NormalizedPush } from "@commander/shared";
import type { CommitListEntry } from "@/integrations/github/commits.client.js";
import type { PushEventEntry } from "@/integrations/github/events.client.js";

const ZERO = /^0+$/;

/** A push the timeline shows, with the commits its `before..head` holds. */
export interface TimelinePush {
  pusher: string;
  shas: string[];
}

/** Part of a branch's gap, and who pushed it — null when no event accounts for it. */
export interface GapPart {
  pusher: string | null;
  commits: CommitListEntry[];
}

/**
 * The events worth asking GitHub about for a gap: pushes to this branch whose
 * head is in it. One that created the branch has no `before` to read from, and
 * one without an actor names nobody anyway.
 */
export function eventsToRead(input: { events: PushEventEntry[]; branch: string; gap: CommitListEntry[] }): PushEventEntry[] {
  const inGap = new Set(input.gap.map((commit) => commit.sha));
  const ref = `refs/heads/${input.branch}`;
  return input.events.filter((event) => event.ref === ref && event.actor !== "" && !ZERO.test(event.before) && inGap.has(event.head));
}

/**
 * The gap, split into the pushes that made it, in the gap's order: one part per
 * push the timeline shows — two pushes by one person stay two, since a push's
 * size is charged per push — and one for whatever none accounts for. A push is
 * taken only when every commit it holds is in the gap and in no push taken
 * before: a span reaching outside the gap describes something other than what
 * was lost.
 */
export function splitByPusher(gap: CommitListEntry[], timeline: TimelinePush[]): GapPart[] {
  const inGap = new Set(gap.map((commit) => commit.sha));
  const partOf = new Map<string, GapPart>();
  for (const push of timeline) {
    const clean = push.shas.length > 0 && push.shas.every((sha) => inGap.has(sha) && !partOf.has(sha));
    const part: GapPart = { pusher: push.pusher, commits: [] };
    if (clean) for (const sha of push.shas) partOf.set(sha, part);
  }

  const parts: GapPart[] = [];
  const unnamed: GapPart = { pusher: null, commits: [] };
  for (const commit of gap) {
    const part = partOf.get(commit.sha) ?? unnamed;
    if (part.commits.length === 0) parts.push(part);
    part.commits.push(commit);
  }
  return parts;
}

/** A recovered push, named by whoever the timeline says made it. */
export function pushedBy(push: NormalizedPush, pusher: string | null): NormalizedPush {
  return pusher === null ? push : { ...push, pushedBy: pusher, actorLogin: pusher };
}
