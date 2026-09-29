/** What arriving on a page touches: the element that takes focus, and the window. */
export interface Arrival {
  content: { focus: (options?: FocusOptions) => void } | null;
  view: { scrollTo: (options: ScrollToOptions) => void };
}

/**
 * Lands on a new page: at its top, with focus on its content (docs/UI-AUDIT.md §7).
 *
 * Both halves are needed. A plain `focus()` lets the browser scroll the content
 * region to the top of the window — under the sticky header — so every long
 * page opened 116px down with its title hidden (W-01). And focusing without
 * scrolling leaves the page wherever the previous one was scrolled to, because
 * a single-page app never resets it on its own.
 */
export function arrive({ content, view }: Arrival): void {
  view.scrollTo({ top: 0 });
  content?.focus({ preventScroll: true });
}
