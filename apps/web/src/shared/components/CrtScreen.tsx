import type { ReactNode } from "react";

interface CrtScreenProps {
  /** Stencilled label across the bezel — the screen's designation. */
  title: string;
  /** Small element pinned to the far end of the header, e.g. a clock. */
  aside?: ReactNode;
  children: ReactNode;
}

/**
 * A cathode-ray display in a bezel. The one place saturated phosphor is allowed
 * (styles/tokens.css), because a screen emits light rather than reflecting it.
 *
 * The `.crt-glass` layer is pure atmosphere and carries no content: scanlines,
 * a corner vignette, and a slow flicker. It sits above the text with
 * `pointer-events: none` so it tints without intercepting, and it is
 * `aria-hidden` because none of it is information — the readout underneath is.
 */
export function CrtScreen({ title, aside, children }: CrtScreenProps) {
  return (
    <div className="crt">
      <div className="crt-head">
        <span className="crt-title stencil">{title}</span>
        {aside ? <span className="crt-aside">{aside}</span> : null}
      </div>
      <div className="crt-tube">
        <div className="crt-content">{children}</div>
        <div className="crt-glass" aria-hidden="true" />
      </div>
    </div>
  );
}
