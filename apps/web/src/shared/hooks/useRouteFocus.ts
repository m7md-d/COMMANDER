import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Moves focus to the content region on every navigation (docs/UI-AUDIT.md §7).
 *
 * In a single-page app the browser does none of this for you: clicking a nav
 * link swaps the DOM while focus stays on the link, so a screen-reader user is
 * never told the page changed and a keyboard user carries on from a position
 * that no longer relates to what is on screen.
 *
 * Skipped on the first render — landing on the app should not steal focus from
 * whatever the browser chose.
 */
export function useRouteFocus() {
  const target = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    target.current?.focus();
  }, [pathname]);

  return target;
}
