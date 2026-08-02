import type { DeliveryStatus } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useToast } from "@/shared/hooks/useToast";
import { ApiError } from "@/shared/api/client";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { useArchiveAll, usePurgeArchive } from "@/features/deliveries/hooks";

export type BulkAction = "archiveAll" | "purge" | null;

interface DispatchBulkDialogsProps {
  action: BulkAction;
  onClose: () => void;
  /** Rows currently listed, shown as the confirmation's subject. */
  count: number;
  /** The active filters, so "archive all" touches exactly the listed set. */
  filters: { status?: DeliveryStatus; repositoryId?: string };
}

/**
 * The two irreversible-ish bulk actions, each behind a confirmation. Owns its
 * own mutations so the page only says which dialog is open — archive is a move
 * (recoverable), purge is a delete (not), and the danger styling reflects that.
 */
export function DispatchBulkDialogs({ action, onClose, count, filters }: DispatchBulkDialogsProps) {
  const t = useTranslate();
  const { notify } = useToast();
  const archiveAll = useArchiveAll();
  const purge = usePurgeArchive();

  const subject = `${count} ${t("dispatch.count")}`;
  const fail = (error: unknown) =>
    notify(t(error instanceof ApiError ? error.i18nKey : "error.unknown"), "error");

  return (
    <>
      <ConfirmDialog
        open={action === "archiveAll"}
        onOpenChange={(open) => (open ? undefined : onClose())}
        title={t("dispatch.archiveAll")}
        subject={subject}
        description={t("dispatch.archiveAllConfirm")}
        confirmLabel={t("dispatch.archiveAll")}
        busy={archiveAll.isPending}
        onConfirm={() =>
          archiveAll.mutate(filters, {
            onSuccess: (result) => {
              notify(t("dispatch.archivedCount", { count: result.count }));
              onClose();
            },
            onError: fail,
          })
        }
      />

      <ConfirmDialog
        open={action === "purge"}
        onOpenChange={(open) => (open ? undefined : onClose())}
        title={t("dispatch.purge")}
        subject={subject}
        description={t("dispatch.purgeConfirm")}
        confirmLabel={t("dispatch.purge")}
        busy={purge.isPending}
        onConfirm={() =>
          purge.mutate(undefined, {
            onSuccess: (result) => {
              notify(t("dispatch.purgedCount", { count: result.count }));
              onClose();
            },
            onError: fail,
          })
        }
      />
    </>
  );
}
