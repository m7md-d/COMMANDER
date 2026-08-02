import { useState } from "react";
import { noteInputSchema, type DossierNote, type NoteInput } from "@commander/shared";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { formatDateTime } from "@/shared/lib/format";
import { Badge } from "@/shared/components/Badge";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { Field } from "@/shared/components/Field";
import { Input } from "@/shared/components/Input";
import { Textarea } from "@/shared/components/Textarea";

interface DossierNotesProps {
  notes: DossierNote[];
  onAdd: (input: NoteInput) => void;
  onDelete: (noteId: string) => void;
  busy: boolean;
}

/**
 * Notes are the one part of the record a human writes. An expiry is offered
 * because most remarks should lapse on their own — a permanent mark is a
 * deliberate choice, not the default the form pushes you towards.
 */
export function DossierNotes({ notes, onAdd, onDelete, busy }: DossierNotesProps) {
  const t = useTranslate();
  const [body, setBody] = useState("");
  const [days, setDays] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const days_ = days.trim();
    const parsed = noteInputSchema.safeParse({
      body,
      ...(days_ === "" ? {} : { expiresInDays: Number(days_) }),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "error.unknown");
      return;
    }

    setError(null);
    setBody("");
    setDays("");
    onAdd(parsed.data);
  };

  return (
    <Card title={t("dossier.notes")}>
      <div className="stack">
        {notes.length === 0 ? (
          <EmptyState message={t("dossier.notesEmpty")} />
        ) : (
          <ul className="stack-sm">
            {notes.map((note) => (
              <li className="row row-bottom" key={note.id}>
                <span>{note.body}</span>
                <span className="spacer" />
                <Badge tone={note.kind === "auto" ? "info" : "neutral"}>
                  {t(note.kind === "auto" ? "dossier.kindAuto" : "dossier.kindManual")}
                </Badge>
                <span className="hint">
                  {note.expiresAt
                    ? `${t("dossier.noteExpires")} ${formatDateTime(note.expiresAt, "—")}`
                    : t("dossier.notePermanent")}
                </span>
                <Button size="sm" variant="ghost" onClick={() => onDelete(note.id)}>
                  {t("action.delete")}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Field label={t("dossier.noteBody")} error={error ? t(error) : undefined}>
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={body}
              invalid={error !== null}
              onChange={(event) => setBody(event.target.value)}
            />
          )}
        </Field>

        <div className="row row-wrap">
          <Field label={t("dossier.noteExpiry")} hint={t("dossier.noteExpiryHint")}>
            {(id) => (
              <Input
                id={id}
                ltr
                inputMode="numeric"
                value={days}
                onChange={(event) => setDays(event.target.value)}
              />
            )}
          </Field>
          <div className="spacer" />
          <Button variant="primary" loading={busy} onClick={submit}>
            {t("dossier.noteAdd")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
