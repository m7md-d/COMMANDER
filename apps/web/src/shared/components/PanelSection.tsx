import type { ReactNode } from "react";

interface PanelSectionProps {
  /** The stencilled heading. Its rule runs to the edge of the sheet. */
  label: string;
  hint?: string;
  children: ReactNode;
}

/**
 * A ruled block inside a file sheet.
 *
 * A sheet holding eight controls in one flat grid is a form; the same eight
 * under three stencilled rules is a document with parts, and the eye finds the
 * one it wants without reading every label. The heading is the same stencil the
 * command menu uses for its groups, so a section on a sheet and a group in the
 * menu are recognisably the same kind of thing.
 */
export function PanelSection({ label, hint, children }: PanelSectionProps) {
  return (
    <section className="panel-section">
      <p className="stencil">{label}</p>
      {hint ? <p className="hint">{hint}</p> : null}
      {children}
    </section>
  );
}
