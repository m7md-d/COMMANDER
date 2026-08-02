import { useState } from "react";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Input } from "@/shared/components/Input";
import { Dialog } from "@/shared/components/Dialog";
import { useModels } from "@/shared/hooks/useModels";
import { ProviderInsignia } from "./ProviderInsignia";
import { ModelPickerList } from "./ModelPickerList";

interface ModelPickerProps {
  value: string;
  onChange: (id: string) => void;
  id?: string;
}

/**
 * Replaces the free-text model id with a picker over OpenRouter's free tier: the
 * current model shows as a division card, and opening it reveals the roster.
 *
 * When the catalogue can't be reached it degrades to plain id entry — the
 * picker is a convenience, never a gate in front of a valid setting.
 */
export function ModelPicker({ value, onChange, id }: ModelPickerProps) {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const { data, isError } = useModels();
  const models = data?.models ?? [];

  if (isError || (data && !data.live && models.length === 0)) {
    return (
      <Input
        id={id}
        ltr
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={t("settings.model")}
      />
    );
  }

  const current = models.find((model) => model.id === value);
  const slug = current?.provider ?? value.split("/")[0] ?? "";
  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <>
      <button id={id} type="button" className="model-trigger" onClick={() => setOpen(true)}>
        <span className="model-insignia">
          <ProviderInsignia provider={slug} />
        </span>
        <span className="model-body">
          <span className="model-name ltr">{current?.name ?? (value || t("model.none"))}</span>
          <span className="model-provider ltr">{current?.providerName ?? slug}</span>
        </span>
        <span className="model-trigger-cue">{t("model.change")}</span>
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("model.title")}
        description={t("model.subtitle")}
      >
        <ModelPickerList models={models} value={value} onCommit={commit} onChange={onChange} />
      </Dialog>
    </>
  );
}
