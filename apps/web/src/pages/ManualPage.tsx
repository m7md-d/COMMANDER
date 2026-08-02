import { Navigate, useParams } from "react-router-dom";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { PageHeader } from "@/shared/components/PageHeader";
import { DEFAULT_SECTION, findSection } from "@/features/manual/sections";
import { ManualIndex } from "@/features/manual/components/ManualIndex";
import { PathArticles } from "@/features/manual/components/PathArticles";
import { LinkArticles } from "@/features/manual/components/LinkArticles";
import { RulesArticles } from "@/features/manual/components/RulesArticles";
import { CalibrationArticles } from "@/features/manual/components/CalibrationArticles";
import { OrdersArticles } from "@/features/manual/components/OrdersArticles";

/** Section id → its articles. A new section is one entry here and one in sections.ts. */
const ARTICLES: Record<string, () => JSX.Element> = {
  path: PathArticles,
  link: LinkArticles,
  rules: RulesArticles,
  calibration: CalibrationArticles,
  orders: OrdersArticles,
};

/**
 * The field manual. Composition only: the index, and the articles of whichever
 * section the route names.
 */
export function ManualPage() {
  const t = useTranslate();
  const { section: id } = useParams();
  const section = findSection(id);

  if (!section) return <Navigate to={`/manual/${DEFAULT_SECTION}`} replace />;

  const Articles = ARTICLES[section.id] ?? PathArticles;

  return (
    <>
      <PageHeader
        eyebrow={t("nav.groupCommand")}
        title={t("manual.title")}
        subtitle={t("manual.subtitle")}
      />

      <div className="manual">
        <ManualIndex />

        <div className="file-sheet manual-sheet">
          <p className="stencil">
            {section.serial} · {t(section.titleKey)}
          </p>
          <Articles />
        </div>
      </div>
    </>
  );
}
