/**
 * The navigation, grouped.
 *
 * Nine flat destinations is a list you re-read every time; named groups are a
 * structure you learn once (docs/UI-AUDIT.md — trackability). The grouping is
 * also the story: what you are doing now, what has been recorded, and what you
 * command.
 *
 * AMENDED 2026-07-26 (CONSTITUTION.md §9). The nine were three groups of three.
 * Two of them — enlistment and rules of engagement — were never destinations at
 * all: each opened by asking which front you meant, so the same repository was
 * picked from a menu four times to finish configuring it once. They are now
 * sections inside a front's file, and what is left here is only what is
 * genuinely cross-front. Seven honest destinations beat nine tidy ones.
 */
export interface NavItem {
  to: string;
  /** Suffix of the `nav.*` translation key. */
  key: string;
  end: boolean;
}

export interface NavGroup {
  /** Suffix of the `nav.group*` translation key. */
  key: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "Operations",
    items: [
      { to: "/overview", key: "overview", end: false },
      { to: "/repositories", key: "repositories", end: false },
    ],
  },
  {
    key: "Records",
    items: [
      { to: "/dossiers", key: "dossier", end: false },
      { to: "/deliveries", key: "deliveries", end: false },
    ],
  },
  {
    key: "Command",
    items: [
      { to: "/prompts", key: "prompts", end: false },
      { to: "/settings", key: "settings", end: false },
      { to: "/setup", key: "setup", end: false },
      { to: "/manual", key: "manual", end: false },
    ],
  },
];

/**
 * The console stations on the headquarters screen — the destinations worked
 * often enough to earn a physical key, in the order they are worked. Everything
 * else stays one tap away in the menu; putting all nine on the console would
 * turn a control panel back into a link list.
 */
export const CONSOLE_STATIONS: NavItem[] = [
  { to: "/repositories", key: "repositories", end: false },
  { to: "/dossiers", key: "dossier", end: false },
  { to: "/deliveries", key: "deliveries", end: false },
  { to: "/overview", key: "overview", end: false },
];
