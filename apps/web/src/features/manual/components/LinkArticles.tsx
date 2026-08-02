import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Article } from "./Article";
import { FactTable } from "./FactTable";

/**
 * What the platform can do with a webhook alone, and what only the GitHub App
 * unlocks. Keyed by capability rather than by setup step, because the question
 * an operator actually arrives with is "why is this column empty".
 */
const CAPABILITIES = [
  { id: "violations", app: false },
  { id: "report", app: false },
  { id: "lines", app: true },
  { id: "review", app: true },
  { id: "scan", app: true },
  { id: "catchup", app: true },
];

export function LinkArticles() {
  const t = useTranslate();
  const mark = (needsApp: boolean, withApp: boolean) =>
    withApp || !needsApp ? t("manual.mark.yes") : t("manual.mark.no");

  return (
    <>
      <Article title={t("manual.link.twoDoors.title")} body={t("manual.link.twoDoors.body")}>
        <FactTable
          head={[t("manual.col.capability"), t("manual.col.webhookOnly"), t("manual.col.withApp")]}
          rows={CAPABILITIES.map((capability) => [
            t(`manual.capability.${capability.id}`),
            mark(capability.app, false),
            mark(capability.app, true),
          ])}
        />
      </Article>

      <Article title={t("manual.link.ids.title")} body={t("manual.link.ids.body")} />
      <Article title={t("manual.link.key.title")} body={t("manual.link.key.body")} />
      <Article title={t("manual.link.reach.title")} body={t("manual.link.reach.body")} />
      <Article title={t("manual.link.branches.title")} body={t("manual.link.branches.body")} />
      <Article title={t("manual.link.silence.title")} body={t("manual.link.silence.body")} />
    </>
  );
}
