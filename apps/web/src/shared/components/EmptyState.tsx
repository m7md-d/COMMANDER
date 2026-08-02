import type { ReactNode } from "react";

interface EmptyStateProps {
  message: string;
  /** The next step out of the dead end — a button or link (docs/UI-AUDIT.md §12). */
  action?: ReactNode;
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-state-message">{message}</p>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
