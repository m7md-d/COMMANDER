import { NavLink } from "react-router-dom";

interface ConsoleButtonProps {
  to: string;
  /** Two-digit station number, printed above the label like a panel legend. */
  code: string;
  label: string;
  description: string;
}

/**
 * A control on the console: a bevelled key with an indicator lamp.
 *
 * The lamp is the state, not a fill — dim when idle, lit on hover and focus,
 * steady when this is the active station. That is the difference between a
 * control panel and a web page of buttons: on a panel you read the lamps, and
 * the surface stays still.
 */
export function ConsoleButton({ to, code, label, description }: ConsoleButtonProps) {
  return (
    <NavLink to={to} className="console-btn">
      <span className="console-lamp" aria-hidden="true" />
      <span className="console-btn-body">
        <span className="console-btn-code" aria-hidden="true">
          {code}
        </span>
        <span className="console-btn-label">{label}</span>
        <span className="console-btn-desc">{description}</span>
      </span>
    </NavLink>
  );
}
