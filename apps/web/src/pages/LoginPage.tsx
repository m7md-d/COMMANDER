import { useState } from "react";
import { LOCALES, type LocaleId } from "@commander/shared";
import { useI18n } from "@/shared/i18n/I18nProvider";
import { useLogin } from "@/features/auth/hooks";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/Button";
import { Field } from "@/shared/components/Field";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

export function LoginPage({ configured }: { configured: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const [password, setPassword] = useState("");
  const login = useLogin();

  const errorKey = login.error instanceof ApiError ? login.error.i18nKey : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password) login.mutate(password);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card stack">
        <div>
          <h1 className="page-title">{t("auth.title")}</h1>
          <p className="page-subtitle">{t("auth.subtitle")}</p>
        </div>

        {configured ? (
          <form className="stack" onSubmit={submit}>
            <Field label={t("auth.password")} error={errorKey ? t(errorKey) : undefined}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  invalid={errorKey !== null}
                  onChange={(event) => setPassword(event.target.value)}
                />
              )}
            </Field>

            <Button type="submit" variant="primary" block loading={login.isPending}>
              {t("auth.submit")}
            </Button>
          </form>
        ) : (
          <p className="badge badge-danger">{t("auth.notConfigured")}</p>
        )}

        <Select
          aria-label={t("locale.label")}
          value={locale}
          onValueChange={(v) => setLocale(v as LocaleId)}
          options={LOCALES.map((entry) => ({ value: entry.id, label: entry.name }))}
        />
      </div>
    </div>
  );
}
