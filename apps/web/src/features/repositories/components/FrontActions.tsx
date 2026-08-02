import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Button } from "@/shared/components/Button";

interface FrontActionsProps {
  onTest: () => void;
  onDigest: () => void;
  onDelete: () => void;
  digesting: boolean;
}

/**
 * What can be done to this front from its letterhead, in order of consequence:
 * a rehearsal, a real send, then the one that ends the file. Delete stays last
 * and stays the only red thing on the rule.
 */
export function FrontActions({ onTest, onDigest, onDelete, digesting }: FrontActionsProps) {
  const t = useTranslate();

  return (
    <>
      <Button size="sm" onClick={onTest}>
        {t("action.test")}
      </Button>
      <Button size="sm" onClick={onDigest} loading={digesting}>
        {t("repos.digestSend")}
      </Button>
      <Button size="sm" variant="danger" onClick={onDelete}>
        {t("action.delete")}
      </Button>
    </>
  );
}
