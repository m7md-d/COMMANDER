import { NavLink } from "react-router-dom";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { MANUAL_SECTIONS } from "@/features/manual/sections";

/**
 * The index down the side of the manual.
 *
 * Every entry carries its serial and a line saying what it answers, because the
 * choice a reader is making is "which of these is my problem" — and a list of
 * five bare titles makes that choice by guesswork. The rail stays put while the
 * sheet scrolls: losing your place in a manual is losing the manual.
 */
export function ManualIndex() {
  const t = useTranslate();

  return (
    <nav className="manual-index" aria-label={t("manual.title")}>
      {MANUAL_SECTIONS.map((section) => (
        <NavLink key={section.id} to={`/manual/${section.id}`} className="manual-entry">
          <span className="manual-serial" aria-hidden="true">
            {section.serial}
          </span>
          <span className="manual-entry-body">
            <span className="manual-entry-title">{t(section.titleKey)}</span>
            <span className="manual-entry-blurb">{t(section.blurbKey)}</span>
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
