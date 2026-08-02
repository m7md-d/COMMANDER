import type { ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { directionOf } from "@commander/shared";
import { useI18n } from "@/shared/i18n/I18nProvider";

export interface TabItem {
  value: string;
  label: string;
  panel: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** Names the tab set for a screen reader; there is no visible heading. */
  "aria-label": string;
}

/**
 * The index tabs of a file — Radix's tabs, wrapped (web CONSTITUTION §8).
 *
 * Radix owns what is tedious and easy to get wrong: `tablist`/`tab`/`tabpanel`
 * roles, arrow-key traversal, and the Tab key skipping past the strip into the
 * panel. `dir` is passed from the locale for the same reason the select and the
 * menu pass it — otherwise the left arrow moves the wrong way in Arabic.
 *
 * Inactive panels are unmounted by Radix rather than hidden, so the tabs of a
 * front cost nothing until opened; the caller may build all of them eagerly.
 *
 * Each tab carries a serial as well as a word. The serial is what makes a strip
 * of tabs navigable by position — the same device the command menu uses — and
 * it is set in mono so the numbers keep one width as the strip wraps.
 */
export function Tabs({ items, value, onValueChange, "aria-label": ariaLabel }: TabsProps) {
  const { locale } = useI18n();

  return (
    <RadixTabs.Root
      value={value}
      onValueChange={onValueChange}
      dir={directionOf(locale)}
      activationMode="manual"
    >
      <RadixTabs.List className="file-tabs" aria-label={ariaLabel}>
        {items.map((item, index) => (
          <RadixTabs.Trigger key={item.value} value={item.value} className="file-tab">
            <span className="file-tab-serial" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>

      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} className="file-sheet">
          {item.panel}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
