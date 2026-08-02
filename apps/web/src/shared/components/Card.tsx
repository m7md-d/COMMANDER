import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  hint?: string;
  actions?: ReactNode;
  accent?: boolean;
  raised?: boolean;
  /** Optional: a card may be a titled step with no body (see SetupPage). */
  children?: ReactNode;
}

export function Card({ title, hint, actions, accent = false, raised = false, children }: CardProps) {
  const classes = ["card", accent ? "card-accent" : "", raised ? "card-raised" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      {title || actions ? (
        <header className="card-header">
          <div>
            {title ? <h3 className="card-title">{title}</h3> : null}
            {hint ? <p className="hint">{hint}</p> : null}
          </div>
          <div className="spacer" />
          {actions}
        </header>
      ) : null}
      {children ?? null}
    </section>
  );
}
