import { LOCALES, type LocaleId, type Theme } from "@commander/shared";
import { useI18n } from "@/shared/i18n/I18nProvider";
import { useTheme } from "@/shared/hooks/useTheme";
import { useLogout } from "@/features/auth/hooks";
import { Button } from "@/shared/components/Button";
import { Select } from "@/shared/components/Select";

const THEMES: Theme[] = ["dark", "light", "system"];

/**
 * Language, theme, sign out.
 *
 * These live in the menu and nowhere else. They are session chores, not
 * destinations, and giving them permanent space in the bar would put three
 * controls you touch once a month next to the one you touch constantly.
 */
export function SessionControls() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const logout = useLogout();

  return (
    <div className="row row-wrap">
      <Select
        aria-label={t("locale.label")}
        value={locale}
        onValueChange={(v) => setLocale(v as LocaleId)}
        options={LOCALES.map((entry) => ({ value: entry.id, label: entry.name }))}
      />
      <Select
        aria-label={t("theme.label")}
        value={theme}
        onValueChange={(v) => setTheme(v as Theme)}
        options={THEMES.map((value) => ({ value, label: t(`theme.${value}`) }))}
      />
      <Button variant="ghost" onClick={() => logout.mutate()}>
        {t("action.logout")}
      </Button>
    </div>
  );
}
