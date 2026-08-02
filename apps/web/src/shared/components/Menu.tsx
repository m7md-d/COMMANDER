import type { ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { NavLink } from "react-router-dom";
import { directionOf } from "@commander/shared";
import { useI18n } from "@/shared/i18n/I18nProvider";

export interface MenuLink {
  key: string;
  label: string;
  to: string;
  end?: boolean;
}

export interface MenuSection {
  key: string;
  label: string;
  links: MenuLink[];
}

interface MenuProps {
  /** The button that opens the menu; Radix wires it as the trigger. */
  trigger: ReactNode;
  sections: MenuSection[];
  /** Non-navigation controls (session settings) pinned below the links. */
  footer?: ReactNode;
}

/**
 * The roving-focus keys Radix owns inside a menu. When the footer holds native
 * <select>s, letting these through means Radix moves menu focus at the same
 * time the browser changes the select — so they are swallowed here. Escape and
 * Tab are deliberately let through, so the menu still closes and focus escapes.
 */
const ROVING_KEYS = new Set(["ArrowUp", "ArrowDown", "Home", "End"]);

/**
 * A compact anchored menu — the one wrapper around Radix's dropdown (web
 * CONSTITUTION §8). It floats over the corner it is opened from and never
 * covers the page: the earlier full-screen board was exactly the thing the
 * brief ruled out.
 *
 * Radix supplies the focus handling, the outside-click and Escape dismissal,
 * roving arrow-key navigation between items, and the `aria` wiring. The exit
 * animation is CSS keyed to `data-state`, which Radix waits for before
 * unmounting — no AnimatePresence needed for a menu this small.
 */
export function Menu({ trigger, sections, footer }: MenuProps) {
  const { locale } = useI18n();

  return (
    <DropdownMenu.Root dir={directionOf(locale)}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu" align="end" sideOffset={8} collisionPadding={12}>
          {sections.map((section) => (
            <DropdownMenu.Group className="menu-group" key={section.key}>
              <DropdownMenu.Label className="menu-label stencil">
                {section.label}
              </DropdownMenu.Label>
              {section.links.map((link) => (
                <DropdownMenu.Item asChild key={link.key}>
                  <NavLink to={link.to} end={link.end} className="menu-item">
                    <span className="nav-marker" aria-hidden="true" />
                    {link.label}
                  </NavLink>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Group>
          ))}

          {footer ? (
            <div
              className="menu-footer"
              onKeyDown={(event) => {
                if (ROVING_KEYS.has(event.key)) event.stopPropagation();
              }}
            >
              {footer}
            </div>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
