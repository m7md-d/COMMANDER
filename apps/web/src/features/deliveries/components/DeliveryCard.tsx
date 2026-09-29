import type { Delivery } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatDateTime } from "@/shared/lib/format";
import { Button } from "@/shared/components/Button";
import { DeliveryReport } from "./DeliveryReport";

interface DeliveryCardProps {
  delivery: Delivery;
  /** The resend button (0012): a first report, or a rewrite of one already sent. */
  onResend: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  busy: boolean;
  /** Dense variant for the compact view: same information, less air. */
  compact?: boolean;
}

/**
 * One dispatch, as a field message slip rather than a table row.
 *
 * Readability is the point of the redesign: the front (repository) is the
 * largest line and the axis (branch) sits beneath it, each behind a stencilled
 * tag, so the eye lands on *where* before *what*. The outcome is a rubber stamp
 * — inked, rotated, letter-spaced — and a failed slip wears the hazard hatch on
 * its top edge, flagging trouble before a word is read.
 */
export function DeliveryCard({
  delivery,
  onResend,
  onArchive,
  onRestore,
  busy,
  compact = false,
}: DeliveryCardProps) {
  const t = useTranslate();
  const failed = delivery.status === "failed";
  const archived = delivery.archivedAt !== null;

  return (
    <article className={`dispatch dispatch-${delivery.status}${compact ? " dispatch-compact" : ""}`}>
      {failed ? <span className="dispatch-hazard hatch-edge hatch-danger" aria-hidden="true" /> : null}

      <header className="dispatch-head">
        <span className="dispatch-stamp">{t(`delivery.status.${delivery.status}`)}</span>
        <span className="spacer" />
        <time className="dispatch-time">{formatDateTime(delivery.createdAt, "—")}</time>
      </header>

      <div className="dispatch-front-block">
        <span className="dispatch-tag">{t("dispatch.front")}</span>
        <span className="dispatch-front ltr mono">{delivery.repositoryFullName}</span>
      </div>

      <div className="dispatch-axis-block">
        <span className="dispatch-tag">{t("dispatch.axis")}</span>
        <span className="dispatch-axis ltr mono">{delivery.branch || "—"}</span>
      </div>

      {compact ? null : (
        <>
          <p className="dispatch-reason">
            {t(`delivery.reason.${delivery.reason}`, delivery.reasonDetail)}
          </p>
          <DeliveryReport delivery={delivery} />
        </>
      )}

      <footer className="dispatch-foot">
        <span className="dispatch-actor ltr mono">{delivery.actorLogin || "—"}</span>
        <span className="dispatch-attempts">
          {t("delivery.attempts")}: {delivery.attempts}
        </span>
        <span className="spacer" />
        {delivery.resend ? (
          <Button size="sm" loading={busy} onClick={() => onResend(delivery.id)}>
            {t(`dispatch.resend.${delivery.resend}`)}
          </Button>
        ) : null}
        {archived ? (
          <Button size="sm" variant="ghost" loading={busy} onClick={() => onRestore(delivery.id)}>
            {t("dispatch.restore")}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" loading={busy} onClick={() => onArchive(delivery.id)}>
            {t("dispatch.archive")}
          </Button>
        )}
      </footer>
    </article>
  );
}
