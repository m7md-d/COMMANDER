import type { MemberInput } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { Field } from "@/shared/components/Field";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";

interface MemberRecordProps {
  member: MemberInput;
  onChange: (key: keyof MemberInput, value: string) => void;
  onRemove: () => void;
}

/**
 * One person's service record.
 *
 * `avatarUrl` is displayed but never edited: it is written by the repository
 * scan, and the whole record is passed through on save so a field this panel
 * does not render is not a field this panel erases.
 */
export function MemberRecord({ member, onChange, onRemove }: MemberRecordProps) {
  const t = useTranslate();

  return (
    <article className="record">
      {member.avatarUrl ? (
        <img className="record-plate" src={member.avatarUrl} alt="" loading="lazy" />
      ) : (
        <span className="record-plate record-plate-empty" aria-hidden="true">
          {member.login.slice(0, 1)}
        </span>
      )}

      <div className="record-body">
        <div className="grid grid-2">
          <Field label={t("member.login")}>
            {(id) => (
              <Input
                id={id}
                ltr
                value={member.login}
                onChange={(event) => onChange("login", event.target.value)}
              />
            )}
          </Field>

          <Field label={t("member.displayName")}>
            {(id) => (
              <Input
                id={id}
                value={member.displayName}
                onChange={(event) => onChange("displayName", event.target.value)}
              />
            )}
          </Field>

          <Field label={t("member.rank")} hint={t("member.rankHint")}>
            {(id) => (
              <Input
                id={id}
                value={member.rank}
                onChange={(event) => onChange("rank", event.target.value)}
              />
            )}
          </Field>

          <Field label={t("member.note")} hint={t("member.noteHint")}>
            {(id) => (
              <Input
                id={id}
                value={member.note}
                onChange={(event) => onChange("note", event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="row">
          <div className="spacer" />
          <Button size="sm" variant="danger" onClick={onRemove}>
            {t("action.delete")}
          </Button>
        </div>
      </div>
    </article>
  );
}
