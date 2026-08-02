import { useState } from "react";
import { UNTRUSTED_TAG, type PromptInput } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useToast } from "@/shared/hooks/useToast";
import { usePreview, usePrompts, useUpdatePrompt } from "@/features/prompts/hooks";
import { useRepositories } from "@/features/repositories/hooks";
import { FormSkeleton } from "@/shared/components/FormSkeleton";
import { PageHeader } from "@/shared/components/PageHeader";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Select } from "@/shared/components/Select";
import { Field } from "@/shared/components/Field";
import { Input } from "@/shared/components/Input";
import { Textarea } from "@/shared/components/Textarea";
import { Badge } from "@/shared/components/Badge";
import { EmptyState } from "@/shared/components/EmptyState";
import { QueryState } from "@/shared/components/QueryState";

export function PromptsPage() {
  const t = useTranslate();
  const { notify } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptInput | null>(null);

  const prompts = usePrompts();
  const repositories = useRepositories();
  const update = useUpdatePrompt();
  const preview = usePreview();

  const list = prompts.data?.prompts ?? [];
  const selected = list.find((prompt) => prompt.id === selectedId) ?? list[0] ?? null;
  const value: PromptInput | null = draft ?? (selected ? { name: selected.name, system: selected.system, user: selected.user } : null);

  // Advisory: losing this clause re-opens prompt injection via commit messages.
  const guardRetained = value?.system.includes(UNTRUSTED_TAG) ?? true;

  const runPreview = () => {
    const repository = repositories.data?.repositories[0];
    if (!repository || !value) return;
    preview.mutate({ repositoryFullName: repository.fullName, promptOverride: value });
  };

  return (
    <>
      <PageHeader
        eyebrow={t("nav.groupCommand")}
        title={t("prompt.title")}
        subtitle={t("prompt.subtitle")}
        actions={
          <Select
            aria-label={t("prompt.title")}
            value={selected?.id ?? ""}
            onValueChange={(v) => { setSelectedId(v); setDraft(null); }}
            options={list.map((prompt) => ({ value: prompt.id, label: prompt.name }))}
          />
        }
      />

      <QueryState
        pending={prompts.isPending}
        error={prompts.error}
        onRetry={() => void prompts.refetch()}
        skeleton={<FormSkeleton fields={3} columns={1} />}
      >
      {!value || !selected ? (
        <Card><EmptyState message={t("state.empty")} /></Card>
      ) : (
        <div className="stack">
          <Card title={t("prompt.variables")} hint={t("prompt.variablesHint")}>
            <div className="chip-list">
              {(prompts.data?.variables ?? []).map((name) => (
                <span className="chip mono ltr" key={name}>{`{{${name}}}`}</span>
              ))}
            </div>
          </Card>

          <Card>
            <div className="stack">
              <Field label={t("prompt.name")}>
                {(id) => <Input id={id} value={value.name} onChange={(e) => setDraft({ ...value, name: e.target.value })} />}
              </Field>

              {!guardRetained ? <Badge tone="danger">{t("prompt.guardWarning")}</Badge> : null}

              <Field label={t("prompt.system")}>
                {(id) => <Textarea id={id} rows={12} value={value.system} onChange={(e) => setDraft({ ...value, system: e.target.value })} />}
              </Field>

              <Field label={t("prompt.user")}>
                {(id) => <Textarea id={id} rows={12} value={value.user} onChange={(e) => setDraft({ ...value, user: e.target.value })} />}
              </Field>
            </div>
          </Card>

          <Card
            title={t("prompt.previewTitle")}
            actions={
              <Button variant="primary" onClick={runPreview} loading={preview.isPending}>
                {t("action.preview")}
              </Button>
            }
          >
            {preview.isPending ? (
              <EmptyState message={t("prompt.previewRunning")} />
            ) : preview.data ? (
              <div className="stack">
                {!preview.data.llmOk ? (
                  <Badge tone="danger">{t("delivery.reason.llm_failed")}</Badge>
                ) : null}
                <div className="report-block">{preview.data.reportText}</div>
              </div>
            ) : (
              <EmptyState message={t("prompt.previewEmpty")} />
            )}
          </Card>
        </div>
      )}
      </QueryState>

      {draft && selected ? (
        <div className="action-bar">
          <span>{t("state.unsavedChanges")}</span>
          <div className="spacer" />
          <Button variant="ghost" onClick={() => setDraft(null)}>{t("action.cancel")}</Button>
          <Button
            variant="primary"
            loading={update.isPending}
            onClick={() =>
              update.mutate(
                { id: selected.id, input: draft },
                { onSuccess: () => { notify(t("state.saved")); setDraft(null); } },
              )
            }
          >
            {t("action.save")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
