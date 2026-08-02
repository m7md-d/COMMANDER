/**
 * The manual's table of contents.
 *
 * Order is the argument, as it is on the headquarters screen: what happens to a
 * push, then what you must connect for it to happen fully, then what is judged,
 * then how hard, then what the model is told. Each section answers a question
 * raised by the one before it.
 */

export interface ManualSection {
  /** Route segment. Its articles live under `manual.<id>.*` in the dictionary. */
  id: string;
  serial: string;
  /**
   * Written out rather than built from the id. A key assembled at runtime is
   * invisible to the guard that deletes translations nobody reads, so the
   * dictionary would slowly fill with entries for sections that no longer
   * exist — and nothing would say so.
   */
  titleKey: string;
  blurbKey: string;
}

export const MANUAL_SECTIONS: ManualSection[] = [
  { id: "path", serial: "01", titleKey: "manual.path.title", blurbKey: "manual.path.blurb" },
  { id: "link", serial: "02", titleKey: "manual.link.title", blurbKey: "manual.link.blurb" },
  { id: "rules", serial: "03", titleKey: "manual.rules.title", blurbKey: "manual.rules.blurb" },
  {
    id: "calibration",
    serial: "04",
    titleKey: "manual.calibration.title",
    blurbKey: "manual.calibration.blurb",
  },
  { id: "orders", serial: "05", titleKey: "manual.orders.title", blurbKey: "manual.orders.blurb" },
];

export const DEFAULT_SECTION = MANUAL_SECTIONS[0]?.id ?? "path";

export function findSection(id: string | undefined): ManualSection | undefined {
  return MANUAL_SECTIONS.find((section) => section.id === id);
}
