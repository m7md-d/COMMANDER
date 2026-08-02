import { useEffect, useState } from "react";

/** The post runs on Riyadh time (UTC+3), the same offset the night-ops rule uses. */
const OFFSET_HOURS = 3;
const ZONE_LABEL = "UTC+3";

function stamp(now: Date): string {
  // Read the wall clock in the fixed offset regardless of the viewer's zone:
  // shift the UTC epoch by the offset, then read the UTC fields back.
  const shifted = new Date(now.getTime() + OFFSET_HOURS * 3_600_000);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * A running ops clock. Not decoration: a fixed offset shown ticking is what
 * tells you the post keeps its own time, and it is the cheapest single element
 * that makes the screen feel manned rather than rendered.
 *
 * One interval, cleared on unmount — the leak pattern the audit called out in
 * useToast, not repeated here.
 */
export function Clock() {
  const [text, setText] = useState(() => stamp(new Date()));

  useEffect(() => {
    const id = setInterval(() => setText(stamp(new Date())), 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="clock ltr" aria-hidden="true">
      <span className="clock-time">{text}</span>
      <span className="clock-zone">{ZONE_LABEL}</span>
    </span>
  );
}
