import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Name the thing being destroyed. A confirmation without a subject gets clicked through. */
  subject: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
}

/**
 * Replaces `window.confirm` for destructive actions (docs/UI-AUDIT.md §2).
 *
 * Two decisions carry the safety here, not the wording: the subject is printed
 * verbatim so the user sees *what* they are about to destroy, and Cancel holds
 * the initial focus so Enter dismisses rather than confirms.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  subject,
  description,
  confirmLabel,
  onConfirm,
  busy = false,
}: ConfirmDialogProps) {
  const t = useTranslate();

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      {...(description !== undefined && { description })}
      footer={
        <>
          <Button variant="ghost" autoFocus onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button variant="danger" loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="dialog-subject ltr mono">{subject}</p>
    </Dialog>
  );
}
