import type { Delivery } from "@commander/shared";

export type DispatchSort = "newest" | "oldest" | "attempts";

/**
 * Client-side ordering for the dispatch list. The server already filters by
 * front and state; ordering is cheap on a page of results and keeps the control
 * instant, with no refetch when the operator flips it.
 *
 * Returns a new array — never sorts the query cache in place, which would mutate
 * shared React Query state.
 */
export function sortDeliveries(items: Delivery[], sort: DispatchSort): Delivery[] {
  const copy = [...items];
  if (sort === "attempts") {
    return copy.sort((a, b) => b.attempts - a.attempts);
  }
  const direction = sort === "oldest" ? 1 : -1;
  return copy.sort((a, b) => direction * a.createdAt.localeCompare(b.createdAt));
}
