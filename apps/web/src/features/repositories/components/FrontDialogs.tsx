import { useTranslate } from "@/shared/i18n/I18nProvider";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";

/** Which confirmation is open, or none. One value rather than a boolean each,
 *  so two dialogs can never both be open. */
export type FrontDialog = "delete" | "digest" | null;

interface FrontDialogsProps {
  open: FrontDialog;
  onClose: () => void;
  subject: string;
  deleting: boolean;
  digesting: boolean;
  onDelete: () => void;
  onDigest: () => void;
}

/**
 * The two acts on this screen that cannot be taken back.
 *
 * The digest is confirmed for a reason the operator cannot see from the button:
 * sending closes the current window and starts a new one, so the week that goes
 * out now will not go out again on schedule. A send that quietly consumes a
 * period is the kind of thing you only discover on the Monday it does not
 * arrive.
 */
export function FrontDialogs({
  open,
  onClose,
  subject,
  deleting,
  digesting,
  onDelete,
  onDigest,
}: FrontDialogsProps) {
  const t = useTranslate();

  return (
    <>
      <ConfirmDialog
        open={open === "delete"}
        onOpenChange={onClose}
        title={t("action.delete")}
        subject={subject}
        description={t("state.confirmDelete")}
        confirmLabel={t("action.delete")}
        busy={deleting}
        onConfirm={onDelete}
      />

      <ConfirmDialog
        open={open === "digest"}
        onOpenChange={onClose}
        title={t("repos.digestSend")}
        subject={subject}
        description={t("repos.digestConfirm")}
        confirmLabel={t("repos.digestSend")}
        busy={digesting}
        onConfirm={onDigest}
      />
    </>
  );
}
