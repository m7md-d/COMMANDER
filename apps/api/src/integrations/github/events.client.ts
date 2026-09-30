/**
 * GitHub's events timeline for a repository: the one record of who pushed, which
 * git itself never keeps. The reconciler reads it to name the pusher of a push
 * whose webhook was lost (D-22). Returns Results, never throws (§6).
 *
 * GitHub's docs: "not built to serve real-time use cases … event latency can be
 * anywhere from 30s to 6h", and the timeline holds "up to 300 events … created
 * within the past 30 days". A push missing from it is ordinary.
 */

import { request, type Result } from "./github.client.js";

/** A push event as the timeline lists it. */
export interface PushEventEntry {
  actor: string;
  /** `refs/heads/<branch>`. */
  ref: string;
  before: string;
  head: string;
}

interface RawEvent {
  type?: string;
  actor?: { login?: string };
  payload?: { ref?: string; before?: string; head?: string };
}

/** 300 events, 100 a page. */
const EVENT_PAGES = 3;

/** The push events on the timeline, newest first. */
export async function listPushEvents(installationId: string, repoFullName: string): Promise<Result<PushEventEntry[]>> {
  const pushes: PushEventEntry[] = [];

  for (let page = 1; page <= EVENT_PAGES; page += 1) {
    const result = await request<RawEvent[]>(installationId, `/repos/${repoFullName}/events?per_page=100&page=${page}`);
    if (!result.ok) return result;
    pushes.push(...result.data.flatMap(toPushEvent));
    if (result.data.length < 100) break;
  }
  return { ok: true, data: pushes };
}

function toPushEvent(event: RawEvent): PushEventEntry[] {
  const { payload } = event;
  if (event.type !== "PushEvent" || !payload?.ref || !payload.before || !payload.head) return [];
  return [{ actor: event.actor?.login ?? "", ref: payload.ref, before: payload.before, head: payload.head }];
}
