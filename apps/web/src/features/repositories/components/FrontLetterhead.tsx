import type { ReactNode } from "react";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatDateTime } from "@/shared/lib/format";
import { highestGravity } from "@/features/repositories/present";
import type { FrontValue } from "@/features/repositories/useFrontDraft";

interface FrontLetterheadProps {
  front: FrontValue;
  /** The file's number on the board, already formatted. */
  serial: string;
  actions: ReactNode;
}

/**
 * The head of the file: designation and standing on one rule, the subject
 * beneath, then the particulars as ruled cells.
 *
 * This is not a PageHeader. A page header names a screen you are on; a
 * letterhead identifies a record you are holding — which is why the repository
 * name is set in mono at the size a page title would be, and why the four
 * readings sit in boxes rather than in a sentence.
 */
export function FrontLetterhead({ front, serial, actions }: FrontLetterheadProps) {
  const t = useTranslate();
  const gravity = highestGravity(front.watchers);

  return (
    <header className="file-head">
      <div className="file-head-top">
        <span className="file-designation">
          {t("front.designation")} · {serial}
        </span>
        <span className={`stamp ${front.enabled ? "stamp-on" : "stamp-off"}`}>
          {front.enabled ? t("state.enabled") : t("state.disabled")}
        </span>
        <div className="spacer" />
        {actions}
      </div>

      <strong className="file-subject ltr">{front.fullName || t("state.unnamed")}</strong>

      <dl className="file-particulars">
        <div>
          <dt>{t("front.partStage")}</dt>
          <dd>{t(`stage.${front.projectStage}.label`)}</dd>
        </div>
        <div>
          <dt>{t("front.partGravity")}</dt>
          <dd>{t(`gravity.${gravity}.label`)}</dd>
        </div>
        <div>
          <dt>{t("front.partMembers")}</dt>
          <dd>{front.members.length}</dd>
        </div>
        <div>
          <dt>{t("repos.branches")}</dt>
          <dd>
            {front.branches.length === 0
              ? t("front.branchesAll")
              : t("front.branchesCount", { count: front.branches.length })}
          </dd>
        </div>
        <div>
          <dt>{t("front.partScanned")}</dt>
          <dd>{formatDateTime(front.lastScannedAt, t("recon.never"))}</dd>
        </div>
      </dl>
    </header>
  );
}
