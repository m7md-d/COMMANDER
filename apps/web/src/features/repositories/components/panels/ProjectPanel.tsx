import { PROJECT_STAGES, STAGE_SHIFT } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Field } from "@/shared/components/Field";
import { Input } from "@/shared/components/Input";
import { Ladder } from "@/shared/components/Ladder";
import { Button } from "@/shared/components/Button";
import { EmptyState } from "@/shared/components/EmptyState";
import { QueryState } from "@/shared/components/QueryState";
import { FormSkeleton } from "@/shared/components/FormSkeleton";
import { PanelSection } from "@/shared/components/PanelSection";
import { useStructure } from "@/features/repositories/hooks";
import { shiftKey } from "@/shared/lib/tone";
import { CalibrationTable } from "@/features/repositories/components/CalibrationTable";
import { SurveyReadout } from "@/features/repositories/components/SurveyReadout";
import type { FrontDraft } from "@/features/repositories/useFrontDraft";

interface ProjectPanelProps {
  draft: FrontDraft;
  onScan: () => void;
  scanning: boolean;
}

/**
 * What the project *is*, and what saying so does.
 *
 * The brief and the stage are the half of the file the model reads before it
 * judges anything — and they are also the settings with no visible effect
 * anywhere in the panel, since their whole output is the register of a
 * communiqué that arrives later. So the sheet does three things in order: takes
 * the setting, states the guidance the model will be given verbatim, and then
 * *works out* the resulting register. If the sheet does not say what
 * "bootstrap" means, nothing in the product does.
 */
export function ProjectPanel({ draft, onScan, scanning }: ProjectPanelProps) {
  const t = useTranslate();
  const { value, patch } = draft;
  const structure = useStructure(value.id);
  const digest = structure.data?.structure ?? null;

  return (
    <>
      <PanelSection label={t("front.sectionStage")}>
        <Field label={t("repos.projectBrief")} hint={t("repos.projectBriefHint")}>
          {(id) => (
            <Input
              id={id}
              value={value.projectBrief}
              onChange={(event) => patch("projectBrief", event.target.value)}
            />
          )}
        </Field>

        <Ladder
          legend={t("repos.projectStage")}
          value={value.projectStage}
          onChange={(next) => patch("projectStage", next as typeof value.projectStage)}
          rungs={PROJECT_STAGES.map((stage) => ({
            value: stage,
            label: t(`stage.${stage}.label`),
            note: t(shiftKey(STAGE_SHIFT[stage])),
          }))}
        />

        <p className="hint">{t(`stage.${value.projectStage}.guidance`)}</p>
      </PanelSection>

      <PanelSection label={t("front.sectionRegister")} hint={t("tone.ladderNote")}>
        <CalibrationTable stage={value.projectStage} />
      </PanelSection>

      <PanelSection label={t("front.sectionRecon")} hint={t("repos.scanHint")}>
        <QueryState
          pending={structure.isPending}
          error={structure.error}
          onRetry={() => void structure.refetch()}
          skeleton={<FormSkeleton fields={2} columns={1} />}
        >
          {digest ? (
            <SurveyReadout digest={digest} scannedAt={value.lastScannedAt} />
          ) : (
            <EmptyState message={t("recon.empty")} />
          )}
        </QueryState>

        <div className="row row-wrap">
          <Button onClick={onScan} loading={scanning}>
            {digest ? t("recon.rescan") : t("repos.scan")}
          </Button>
        </div>
      </PanelSection>
    </>
  );
}
