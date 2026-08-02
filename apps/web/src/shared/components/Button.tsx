import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "primary" | "ghost" | "danger";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: Variant;
  size?: "sm" | "md";
  block?: boolean;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  default: "",
  primary: "btn-primary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

/**
 * `className` is intentionally not forwarded: styling belongs to the design
 * system, and an escape hatch here is how ad-hoc colours get in (CONSTITUTION §2).
 *
 * The ref IS forwarded, and it is not optional: Radix's `asChild` triggers
 * (menu, dialog, tooltip) clone their child and attach a ref to anchor and
 * measure the popover. Without forwardRef the ref is dropped and the trigger
 * silently fails to open — the menu-button-does-nothing bug.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "default",
    size = "md",
    block = false,
    loading = false,
    disabled,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  const classes = ["btn", VARIANT_CLASS[variant], size === "sm" ? "btn-sm" : "", block ? "btn-block" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled === true || loading}
      // Without this a screen reader announces a button that is simply
      // disabled, with no hint that it is working (docs/UI-AUDIT.md §14).
      aria-busy={loading || undefined}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
