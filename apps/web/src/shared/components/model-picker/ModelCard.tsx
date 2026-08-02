import type { ModelOption } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatRange } from "./present";
import { ProviderInsignia } from "./ProviderInsignia";

interface ModelCardProps {
  model: ModelOption;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * One model as a selectable roster row: division insignia, the model's name and
 * provider, then its stats as stencilled tags. Selection is conveyed by
 * `aria-pressed` (not colour alone) and stamped with a check.
 */
export function ModelCard({ model, selected, onSelect }: ModelCardProps) {
  const t = useTranslate();

  return (
    <button
      type="button"
      className="model-card"
      aria-pressed={selected}
      onClick={() => onSelect(model.id)}
    >
      <span className="model-insignia">
        <ProviderInsignia provider={model.provider} />
      </span>

      <span className="model-body">
        <span className="model-name ltr">{model.name}</span>
        <span className="model-provider ltr">{model.providerName}</span>
        <span className="model-tags">
          <span className="model-stat">
            {t("model.range")} · {formatRange(model.contextLength)}
          </span>
          {model.vision ? <span className="model-flag">{t("model.vision")}</span> : null}
          <span className="model-free">{t("model.free")}</span>
        </span>
      </span>

      {selected ? (
        <span className="model-check" aria-hidden="true">
          <svg viewBox="0 0 16 16" focusable="false">
            <path
              d="M3 8.5l3.5 3.5L13 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ) : null}
    </button>
  );
}
