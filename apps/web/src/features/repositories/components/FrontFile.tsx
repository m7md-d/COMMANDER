import { useState } from "react";
import type { Repository } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Tabs } from "@/shared/components/Tabs";
import { useFrontDraft } from "@/features/repositories/useFrontDraft";
import { FIRST_TAB } from "@/features/repositories/tabs";
import { FrontActions } from "./FrontActions";
import { FrontLetterhead } from "./FrontLetterhead";
import { FrontSaveBar } from "./FrontSaveBar";
import { IdentityPanel } from "./panels/IdentityPanel";
import { ProjectPanel } from "./panels/ProjectPanel";
import { BranchesPanel } from "./panels/BranchesPanel";
import { RulesPanel } from "./panels/RulesPanel";
import { RosterPanel } from "./panels/RosterPanel";
import { TreePanel } from "./panels/TreePanel";

interface FrontFileProps {
  repository: Repository;
  serial: string;
  promptOptions: { value: string; label: string }[];
  webhookUrl: string;
  onSave: (patch: ReturnType<typeof useFrontDraft>["changes"]) => void;
  onDelete: () => void;
  onTest: () => void;
  onDigest: () => void;
  onScan: () => void;
  saving: boolean;
  scanning: boolean;
  digesting: boolean;
  /** Headquarters' hour offset, for reading the schedule's slot. */
  timezoneOffset: number;
}

/**
 * One front's file: letterhead, index tabs, and a save bar that belongs to the
 * whole document rather than to the section you happen to be looking at.
 *
 * Mounted per repository id by the page, so the draft is discarded by unmount
 * when you switch fronts — see useFrontDraft.
 */
export function FrontFile({
  repository,
  serial,
  promptOptions,
  webhookUrl,
  onSave,
  onDelete,
  onTest,
  onDigest,
  onScan,
  saving,
  scanning,
  digesting,
  timezoneOffset,
}: FrontFileProps) {
  const t = useTranslate();
  const draft = useFrontDraft(repository);
  const [tab, setTab] = useState<string>(FIRST_TAB);

  return (
    <>
      <FrontLetterhead
        front={draft.value}
        serial={serial}
        actions={
          <FrontActions
            onTest={onTest}
            onDigest={onDigest}
            onDelete={onDelete}
            digesting={digesting}
          />
        }
      />

      <Tabs
        aria-label={t("front.tabs")}
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: "identity",
            label: t("front.tabIdentity"),
            panel: (
              <IdentityPanel
                draft={draft}
                promptOptions={promptOptions}
                webhookUrl={webhookUrl}
                timezoneOffset={timezoneOffset}
              />
            ),
          },
          {
            value: "project",
            label: t("front.tabProject"),
            panel: <ProjectPanel draft={draft} onScan={onScan} scanning={scanning} />,
          },
          {
            value: "branches",
            label: t("front.tabBranches"),
            panel: <BranchesPanel draft={draft} />,
          },
          {
            value: "rules",
            label: t("nav.rules"),
            panel: <RulesPanel draft={draft} />,
          },
          {
            value: "roster",
            label: t("nav.members"),
            panel: <RosterPanel draft={draft} />,
          },
          {
            value: "tree",
            label: t("front.tabTree"),
            // Reads the stored snapshot rather than the draft: the tree is a
            // record of what is in the repository, not a setting to edit.
            panel: (
              <TreePanel
                repositoryId={repository.id}
                templateId={draft.value.checkTemplateId}
                overrides={draft.value.checks}
                onScan={onScan}
                scanning={scanning}
              />
            ),
          },
        ]}
      />

      {draft.dirty ? (
        <FrontSaveBar
          saving={saving}
          onCancel={draft.reset}
          onSave={() => {
            onSave(draft.changes);
            draft.reset();
          }}
        />
      ) : null}
    </>
  );
}
