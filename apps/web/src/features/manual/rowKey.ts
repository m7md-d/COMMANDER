import { isValidElement, type ReactNode } from "react";

/**
 * A table row's React key, from its subject cell.
 *
 * Text keys by itself. An element keys by its own key when it has one — the
 * orders table hands `<code key={name}>` — and by its position otherwise:
 * `String(element)` is "[object Object]" for every row, which gave the whole
 * table one key (W-14). The manual's tables never reorder, so a position is a
 * stable identity there.
 */
export function rowKey(cells: ReactNode[], index: number): string {
  const subject = cells[0];
  if (typeof subject === "string" || typeof subject === "number") return String(subject);
  if (isValidElement(subject) && subject.key !== null) return String(subject.key);
  return String(index);
}
