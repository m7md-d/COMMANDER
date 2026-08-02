import type { Repository } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Select } from "./Select";

interface RepositoryPickerProps {
  repositories: Repository[];
  value: string | null;
  onChange: (id: string) => void;
}

/** Shared by every per-repository page so the control behaves identically. */
export function RepositoryPicker({ repositories, value, onChange }: RepositoryPickerProps) {
  const t = useTranslate();

  if (repositories.length === 0) return null;

  return (
    <Select
      aria-label={t("nav.repositories")}
      value={value ?? ""}
      onValueChange={onChange}
      options={repositories.map((repository) => ({
        value: repository.id,
        label: repository.fullName,
      }))}
    />
  );
}

/** Falls back to the first repository so a page is never empty by accident. */
export function resolveSelected(repositories: Repository[], selected: string | null): Repository | null {
  if (repositories.length === 0) return null;
  return repositories.find((repository) => repository.id === selected) ?? repositories[0] ?? null;
}
