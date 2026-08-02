import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Button } from "@/shared/components/Button";

interface FrontSaveBarProps {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}

/**
 * The bar that appears only once something has changed.
 *
 * It belongs to the whole file rather than to the tab in view — an edit made on
 * one tab and saved from another is the normal case, and a per-tab save button
 * would teach people to fear switching tabs.
 */
export function FrontSaveBar({ onCancel, onSave, saving }: FrontSaveBarProps) {
  const t = useTranslate();

  return (
    <div className="action-bar">
      <span>{t("state.unsavedChanges")}</span>
      <div className="spacer" />
      <Button variant="ghost" onClick={onCancel}>
        {t("action.cancel")}
      </Button>
      <Button variant="primary" loading={saving} onClick={onSave}>
        {t("action.save")}
      </Button>
    </div>
  );
}
