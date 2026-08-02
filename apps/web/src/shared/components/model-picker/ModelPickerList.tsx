import { useState } from "react";
import type { ModelOption } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Input } from "@/shared/components/Input";
import { EmptyState } from "@/shared/components/EmptyState";
import { filterModels } from "./present";
import { ModelCard } from "./ModelCard";

interface ModelPickerListProps {
  models: ModelOption[];
  value: string;
  /** Picking a card commits and closes; the custom-id field only updates. */
  onCommit: (id: string) => void;
  onChange: (id: string) => void;
}

/**
 * The dialog body: a search field, the ranked roster, and a manual-id escape
 * hatch so a power user is never boxed in by the curated list.
 */
export function ModelPickerList({ models, value, onCommit, onChange }: ModelPickerListProps) {
  const t = useTranslate();
  const [query, setQuery] = useState("");
  const shown = filterModels(models, query);

  return (
    <div className="model-picker">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("model.search")}
        aria-label={t("model.search")}
      />
      <p className="hint model-count">{t("model.count", { count: shown.length })}</p>

      {shown.length === 0 ? (
        <EmptyState message={t("model.empty")} />
      ) : (
        <div className="model-grid">
          {shown.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              selected={model.id === value}
              onSelect={onCommit}
            />
          ))}
        </div>
      )}

      <div className="model-custom">
        <span className="field-label">{t("model.custom")}</span>
        <Input
          ltr
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={t("model.custom")}
        />
        <span className="hint">{t("model.customHint")}</span>
      </div>
    </div>
  );
}
