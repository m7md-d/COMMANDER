import { useState } from "react";
import { DEFAULT_CHECKS, type CheckTemplate, type PartialCheckMap } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Button } from "@/shared/components/Button";
import { EmptyState } from "@/shared/components/EmptyState";
import { Field } from "@/shared/components/Field";
import { Input } from "@/shared/components/Input";
import { QueryState } from "@/shared/components/QueryState";
import {
  useCheckTemplates,
  useCreateCheckTemplate,
  useDeleteCheckTemplate,
  useUpdateCheckTemplate,
} from "@/features/repositories/hooks";
import { CheckFields } from "./CheckFields";

interface Draft {
  id: string | null;
  name: string;
  checks: PartialCheckMap;
}

const BLANK: Draft = { id: null, name: "", checks: {} };

function toDraft(template: CheckTemplate): Draft {
  return { id: template.id, name: template.name, checks: template.checks };
}

/**
 * The shared limits, edited where the rest of headquarters is edited.
 *
 * One draft at a time rather than every row being a live form: a template is
 * inherited by several fronts, so an edit here is not a local change, and making
 * it deliberate — pick, edit, save — is the point rather than friction.
 */
export function CheckTemplates() {
  const t = useTranslate();
  const templates = useCheckTemplates();
  const create = useCreateCheckTemplate();
  const update = useUpdateCheckTemplate();
  const remove = useDeleteCheckTemplate();
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = () => {
    if (!draft || draft.name.trim().length === 0) return;
    const input = { name: draft.name, checks: draft.checks };

    if (draft.id) update.mutate({ id: draft.id, input });
    else create.mutate(input);
    setDraft(null);
  };

  return (
    <QueryState
      pending={templates.isPending}
      error={templates.error}
      onRetry={() => void templates.refetch()}
      lines={3}
    >
      <div className="stack">
        {(templates.data?.templates ?? []).length === 0 && !draft ? (
          <EmptyState message={t("checks.templateEmpty")} />
        ) : null}

        <div className="pick-list">
          {(templates.data?.templates ?? []).map((template) => (
            <div className="pick-item" key={template.id}>
              <span className="stack-sm">
                <span>{template.name}</span>
                <span className="hint">
                  {t("checks.templateUsage", { count: template.repositoryCount })}
                </span>
              </span>
              <span className="spacer" />
              <Button size="sm" onClick={() => setDraft(toDraft(template))}>
                {t("action.edit")}
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={remove.isPending}
                onClick={() => remove.mutate(template.id)}
              >
                {t("action.delete")}
              </Button>
            </div>
          ))}
        </div>

        {draft ? (
          <div className="stack">
            <Field label={t("checks.templateName")}>
              {(id) => (
                <Input
                  id={id}
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              )}
            </Field>

            {/* A template layers over the shipped defaults, so those are what its
                blank fields inherit — the same three-layer story as a front, one
                layer shorter. */}
            <CheckFields
              value={draft.checks}
              onChange={(checks) => setDraft({ ...draft, checks })}
              inherited={templates.data?.defaults ?? DEFAULT_CHECKS}
            />

            <div className="row">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                {t("action.cancel")}
              </Button>
              <Button variant="primary" loading={create.isPending || update.isPending} onClick={save}>
                {t("action.save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="row">
            <Button size="sm" onClick={() => setDraft(BLANK)}>
              {t("checks.templateAdd")}
            </Button>
            <span className="hint">{t("checks.templateDeleteWarn")}</span>
          </div>
        )}
      </div>
    </QueryState>
  );
}
