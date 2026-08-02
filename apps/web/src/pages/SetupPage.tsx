import { Link } from "react-router-dom";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useRepositories } from "@/features/repositories/hooks";
import { PageHeader } from "@/shared/components/PageHeader";
import { Card } from "@/shared/components/Card";
import { Field } from "@/shared/components/Field";
import { CopyField } from "@/shared/components/CopyField";

/**
 * Wiring a repository to the post, once.
 *
 * Three of these steps used to be a heading with nothing under it — on the one
 * screen whose entire job is to teach. A step that names itself and then says
 * nothing is worse than no step: it reads as an instruction the reader has
 * failed to understand.
 *
 * What is deliberately *not* here is the mechanism behind each step. That lives
 * in the manual, and stating it twice would give two accounts to keep in
 * agreement — so each step links to its section instead.
 */
export function SetupPage() {
  const t = useTranslate();
  const repositories = useRepositories();

  return (
    <>
      <PageHeader
        eyebrow={t("nav.groupCommand")}
        title={t("setup.title")}
        subtitle={t("setup.subtitle")}
      />

      <div className="stack">
        <Card title={t("setup.step1")}>
          <p className="hint">{t("setup.step1Body")}</p>
        </Card>

        <Card title={t("setup.step2")} hint={t("setup.step2Hint")}>
          <div className="stack">
            <Field label={t("setup.payloadUrl")}>
              {() => (
                <CopyField
                  value={repositories.data?.webhookUrl ?? ""}
                  copyLabel={t("action.copy")}
                  copiedLabel={t("action.copied")}
                />
              )}
            </Field>
            <Field label={t("setup.secretField")} hint={t("setup.secretFieldHint")}>
              {() => <p className="code-block ltr">GITHUB_WEBHOOK_SECRET</p>}
            </Field>
          </div>
        </Card>

        <Card title={t("setup.step3")} hint={t("setup.step3Hint")}>
          <p className="hint">{t("setup.step3Body")}</p>
        </Card>

        <Card title={t("setup.appTitle")} accent>
          <div className="stack">
            <p className="hint">{t("setup.appBody")}</p>
            <p>
              <Link to="/manual/link">{t("setup.manualLink")}</Link>
            </p>
          </div>
        </Card>

        <Card title={t("setup.tunnelTitle")}>
          <p className="hint">{t("setup.tunnelHint")}</p>
        </Card>

        <Card>
          <p className="hint">{t("setup.privacyHint")}</p>
        </Card>
      </div>
    </>
  );
}
