import { GRAVITY_LEVELS, type Watcher } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { EmptyState } from "@/shared/components/EmptyState";

/**
 * The ordered watcher list. Order is the contract — the first matching pattern
 * governs the branch — so rows are edited in place and never sorted for display.
 */
export function WatcherFields({
  watchers,
  onChange,
}: {
  watchers: Watcher[];
  onChange: (next: Watcher[]) => void;
}) {
  const t = useTranslate();

  const patch = (index: number, changes: Partial<Watcher>) =>
    onChange(watchers.map((watcher, i) => (i === index ? { ...watcher, ...changes } : watcher)));

  return (
    <div className="stack-sm">
      {watchers.length === 0 ? (
        <EmptyState message={t("repos.watchersEmpty")} />
      ) : (
        watchers.map((watcher, index) => (
          <div key={index} className="watcher-row">
            <Input
              ltr
              aria-label={t("repos.watcherPattern")}
              value={watcher.pattern}
              onChange={(event) => patch(index, { pattern: event.target.value })}
            />
            <Select
              aria-label={t("repos.watcherGravity")}
              value={watcher.gravity}
              onValueChange={(next) => patch(index, { gravity: next as Watcher["gravity"] })}
              options={GRAVITY_LEVELS.map((level) => ({
                value: level,
                label: t(`gravity.${level}.label`),
              }))}
            />
            <Button
              variant="ghost"
              onClick={() => onChange(watchers.filter((_, i) => i !== index))}
            >
              {t("action.delete")}
            </Button>
          </div>
        ))
      )}

      <Button
        size="sm"
        onClick={() =>
          onChange([...watchers, { pattern: "", gravity: "routine", promptId: null, model: "" }])
        }
      >
        {t("repos.watcherAdd")}
      </Button>
    </div>
  );
}
