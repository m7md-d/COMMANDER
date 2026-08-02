import type { SecretStatus } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Badge } from "@/shared/components/Badge";

interface SecretBadgesProps {
  /** Name → present. Never the value: a secret the panel can read back is one
   *  screenshot away from being published (CONSTITUTION §7). */
  secrets: Partial<SecretStatus>;
}

/** Which secrets the server actually holds, as present-or-missing badges. */
export function SecretBadges({ secrets }: SecretBadgesProps) {
  const t = useTranslate();

  return (
    <div className="chip-list">
      {Object.entries(secrets).map(([name, present]) => (
        <span className="row" key={name}>
          <span className="mono ltr">{name}</span>
          <Badge tone={present ? "success" : "danger"}>
            {present ? t("settings.secretSet") : t("settings.secretMissing")}
          </Badge>
        </span>
      ))}
    </div>
  );
}
