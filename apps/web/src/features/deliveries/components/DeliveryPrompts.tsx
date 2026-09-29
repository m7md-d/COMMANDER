import { useState } from "react";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useDeliveryDetail } from "../hooks";

interface DeliveryPromptsProps {
  id: string;
  model: string | null;
}

/**
 * What the model was given for this dispatch, and by which name (0012). Folded
 * and fetched only when opened: a page of sixty slips should not carry sixty
 * prompts. The prompt quotes commit titles, which are hostile input — it is
 * shown as text, never as markup.
 */
export function DeliveryPrompts({ id, model }: DeliveryPromptsProps) {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const detail = useDeliveryDetail(id, open);

  return (
    <details className="dispatch-fold" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{t("dispatch.details")}</summary>
      <p className="dispatch-model">
        {t("dispatch.model")}: <span className="ltr mono">{model ?? "—"}</span>
      </p>
      {detail.data ? (
        <>
          <Prompt title={t("dispatch.systemPrompt")} text={detail.data.systemPrompt} />
          <Prompt title={t("dispatch.userPrompt")} text={detail.data.userPrompt} />
        </>
      ) : open ? (
        <p className="dispatch-model">{t(detail.isError ? "error.unknown" : "state.loading")}</p>
      ) : null}
    </details>
  );
}

function Prompt({ title, text }: { title: string; text: string | null }) {
  const t = useTranslate();
  return (
    <>
      <span className="dispatch-tag">{title}</span>
      <pre className="dispatch-prompt">{text ?? t("dispatch.notKept")}</pre>
    </>
  );
}
