import { useState } from "react";
import type { Settings, SettingsUpdate } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useToast } from "@/shared/hooks/useToast";
import { useSecretStatus, useSettings, useUpdateSettings } from "@/features/settings/hooks";
import { FormSkeleton } from "@/shared/components/FormSkeleton";
import { PageHeader } from "@/shared/components/PageHeader";
import { Card } from "@/shared/components/Card";
import { CheckTemplates } from "@/features/repositories/components/CheckTemplates";
import { SettingsForm } from "@/features/settings/components/SettingsForm";
import { Button } from "@/shared/components/Button";
import { EmptyState } from "@/shared/components/EmptyState";
import { QueryState } from "@/shared/components/QueryState";

export function SettingsPage() {
  const t = useTranslate();
  const { notify } = useToast();
  const [draft, setDraft] = useState<SettingsUpdate | null>(null);

  const settings = useSettings();
  const secrets = useSecretStatus();
  const update = useUpdateSettings();

  // Real state — skeleton, or error with a retry — never an eternal spinner when
  // a load fails (docs/UI-AUDIT.md §1).
  if (!settings.data) {
    return (
      <QueryState pending={settings.isPending} error={settings.error} onRetry={() => void settings.refetch()} skeleton={<FormSkeleton fields={8} />}>
        <EmptyState message={t("state.empty")} />
      </QueryState>
    );
  }

  const value: Settings = { ...settings.data, ...draft };
  const patch = <K extends keyof Settings>(key: K, next: Settings[K]) =>
    setDraft((current) => ({ ...current, [key]: next }));

  return (
    <>
      <PageHeader
        eyebrow={t("nav.groupCommand")}
        title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="stack">
        <SettingsForm value={value} patch={patch} secrets={secrets.data ?? {}} />

        {/* Check defaults belong to repositories, so the card stays composed here
            rather than pulling one feature into another (web §1). */}
        <Card title={t("checks.title")} hint={t("checks.subtitle")}>
          <CheckTemplates />
        </Card>
      </div>

      {draft ? (
        <div className="action-bar">
          <span>{t("state.unsavedChanges")}</span>
          <div className="spacer" />
          <Button variant="ghost" onClick={() => setDraft(null)}>{t("action.cancel")}</Button>
          <Button
            variant="primary"
            loading={update.isPending}
            onClick={() =>
              update.mutate(draft, {
                onSuccess: () => { notify(t("state.saved")); setDraft(null); },
              })
            }
          >
            {t("action.save")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
