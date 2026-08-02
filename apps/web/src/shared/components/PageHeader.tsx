import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * The screen's designation, set above the title. Optional because not every
   * screen is a post — but where it exists it is what makes a page feel like a
   * station in a chain of command rather than a tab in an app.
   */
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <span className="page-eyebrow">{eyebrow}</span> : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      <div className="spacer" />
      {actions ? <div className="row row-wrap">{actions}</div> : null}
    </header>
  );
}
