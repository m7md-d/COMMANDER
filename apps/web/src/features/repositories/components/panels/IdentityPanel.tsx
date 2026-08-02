import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Field } from "@/shared/components/Field";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { Toggle } from "@/shared/components/Toggle";
import { CopyField } from "@/shared/components/CopyField";
import { PanelSection } from "@/shared/components/PanelSection";
import { ModelPicker } from "@/shared/components/model-picker/ModelPicker";
import { ScheduleFields, scheduleOf } from "../ScheduleFields";
import type { FrontDraft } from "@/features/repositories/useFrontDraft";

interface IdentityPanelProps {
  draft: FrontDraft;
  promptOptions: { value: string; label: string }[];
  webhookUrl: string;
  /** Handed down from the page rather than read here: it is headquarters' setting,
   *  and a feature reaching into another feature is what §1 forbids. */
  timezoneOffset: number;
}

/**
 * Who this front is and where its traffic goes.
 *
 * Ordered as the wiring is done, not as the columns fall: name the repository,
 * open the two ends of the line (in from GitHub, out to Discord), say who
 * speaks, then arm it. A field's position on the sheet is the order you would
 * fill it in on paper.
 */
export function IdentityPanel({
  draft,
  promptOptions,
  webhookUrl,
  timezoneOffset,
}: IdentityPanelProps) {
  const t = useTranslate();
  const { value, patch } = draft;

  return (
    <>
      <PanelSection label={t("front.sectionSubject")}>
        <Field label={t("repos.fullName")} hint={t("repos.fullNameHint")}>
          {(id) => (
            <Input
              id={id}
              ltr
              value={value.fullName}
              onChange={(event) => patch("fullName", event.target.value)}
            />
          )}
        </Field>
      </PanelSection>

      <PanelSection label={t("front.sectionLine")} hint={t("front.sectionLineHint")}>
        <Field label={t("repos.webhookUrl")}>
          {() => (
            <CopyField
              value={webhookUrl}
              copyLabel={t("action.copy")}
              copiedLabel={t("action.copied")}
            />
          )}
        </Field>

        <div className="grid grid-2">
          <Field label={t("repos.discordUrl")} hint={t("repos.discordUrlHint")}>
            {(id) => (
              <Input
                id={id}
                ltr
                type="url"
                value={value.discordWebhookUrl}
                onChange={(event) => patch("discordWebhookUrl", event.target.value)}
              />
            )}
          </Field>

          <Field label={t("repos.installationId")} hint={t("repos.installationHint")}>
            {(id) => (
              <Input
                id={id}
                ltr
                inputMode="numeric"
                value={value.githubInstallationId}
                onChange={(event) => patch("githubInstallationId", event.target.value)}
              />
            )}
          </Field>
        </div>
      </PanelSection>

      <PanelSection label={t("front.sectionVoice")}>
        <div className="grid grid-2">
          <Field label={t("repos.model")} hint={t("repos.modelHint")}>
            {(id) => (
              <ModelPicker id={id} value={value.model} onChange={(next) => patch("model", next)} />
            )}
          </Field>

          <Field label={t("repos.prompt")}>
            {(id) => (
              <Select
                id={id}
                value={value.promptId ?? "__none__"}
                onValueChange={(next) => patch("promptId", next === "__none__" ? null : next)}
                options={[{ value: "__none__", label: t("state.none") }, ...promptOptions]}
              />
            )}
          </Field>
        </div>
      </PanelSection>

      <PanelSection label={t("schedule.section")} hint={t("schedule.sectionHint")}>
        <ScheduleFields
          value={scheduleOf(value.schedules)}
          timezoneOffset={timezoneOffset}
          onChange={(next) => patch("schedules", { weekly_digest: next })}
        />
      </PanelSection>

      <PanelSection label={t("front.sectionState")}>
        <div className="row row-wrap">
          <Toggle
            label={t("repos.enabled")}
            checked={value.enabled}
            onChange={(next) => patch("enabled", next)}
          />
          <Toggle
            label={t("repos.silentWhenClean")}
            checked={value.silentWhenClean}
            onChange={(next) => patch("silentWhenClean", next)}
          />
        </div>
      </PanelSection>
    </>
  );
}
