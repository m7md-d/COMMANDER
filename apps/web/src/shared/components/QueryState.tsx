import type { ReactNode } from "react";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { ApiError } from "@/shared/api/client";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";

interface QueryStateProps {
  pending: boolean;
  error: unknown;
  onRetry?: () => void;
  /** Roughly how tall the eventual content is, so the placeholder matches it. */
  lines?: number;
  /**
   * A placeholder built from the eventual content's own layout classes. Give
   * one wherever the content is not simply prose: the generic stack reserves a
   * height the real thing will not have, and the page jumps by the difference
   * (docs/UI-AUDIT.md §6).
   */
  skeleton?: ReactNode;
  children: ReactNode;
}

/**
 * Three states, stated explicitly (docs/UI-AUDIT.md §1).
 *
 * The pattern this replaces was `if (!data) return "loading"`, which cannot
 * tell "not here yet" from "will never arrive": a 500, an expired session or a
 * dropped connection all rendered as a spinner that spun forever. Claiming to
 * be loading when nothing is loading is worse than an error message, because it
 * tells the user to wait instead of to act.
 */
export function QueryState({
  pending,
  error,
  onRetry,
  lines = 4,
  skeleton,
  children,
}: QueryStateProps) {
  const t = useTranslate();

  if (pending) {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="visually-hidden">{t("state.loading")}</span>
        {skeleton ?? <Skeleton lines={lines} />}
      </div>
    );
  }

  if (error) {
    // The API's own key when we have one: "session expired" is far more
    // actionable than "could not load".
    const key = error instanceof ApiError ? error.i18nKey : "error.loadFailed";

    return (
      <div className="stack-sm" role="alert">
        <p>{t(key)}</p>
        {onRetry ? (
          <div className="row">
            <Button size="sm" onClick={onRetry}>
              {t("action.retry")}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
