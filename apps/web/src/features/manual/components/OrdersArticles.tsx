import { PROJECT_CONTEXT_VARIABLES, PROMPT_VARIABLES, UNTRUSTED_TAG } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Article } from "./Article";
import { FactTable } from "./FactTable";

const CONTEXT = new Set<string>(PROJECT_CONTEXT_VARIABLES);

/**
 * What the model is handed, and the two rules that keep it from being steered
 * by the repository it is judging.
 *
 * The variable table is `PROMPT_VARIABLES` itself — the same list the panel
 * renders as chips and the builder fills in. A variable that exists but is
 * undocumented, or documented but gone, is impossible by construction.
 */
export function OrdersArticles() {
  const t = useTranslate();

  return (
    <>
      <Article title={t("manual.orders.vars.title")} body={t("manual.orders.vars.body")}>
        <FactTable
          head={[t("manual.col.variable"), t("manual.col.carries"), t("manual.col.group")]}
          rows={PROMPT_VARIABLES.map((name) => [
            <code className="ltr" key={name}>{`{{${name}}}`}</code>,
            t(`var.${name}`),
            t(CONTEXT.has(name) ? "manual.group.context" : "manual.group.push"),
          ])}
        />
      </Article>

      <Article title={t("manual.orders.prepend.title")} body={t("manual.orders.prepend.body")} />
      <Article title={t("manual.orders.override.title")} body={t("manual.orders.override.body")} />

      <Article title={t("manual.orders.untrusted.title")} body={t("manual.orders.untrusted.body")}>
        <p className="code-block ltr">{`<${UNTRUSTED_TAG}> … </${UNTRUSTED_TAG}>`}</p>
      </Article>

      <Article title={t("manual.orders.clamp.title")} body={t("manual.orders.clamp.body")} />
      <Article title={t("manual.orders.stored.title")} body={t("manual.orders.stored.body")} />
    </>
  );
}
