import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useToast } from "@/shared/hooks/useToast";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { EmptyState } from "@/shared/components/EmptyState";
import { useAddNote, useDeleteNote, useDossier, useRegenerateNarrative } from "../hooks";
import { DossierBreakdown } from "./DossierBreakdown";
import { DossierFiles } from "./DossierFiles";
import { DossierMedals } from "./DossierMedals";
import { DossierNarrative } from "./DossierNarrative";
import { DossierNotes } from "./DossierNotes";
import { DossierOverview } from "./DossierOverview";
import { DossierReviews } from "./DossierReviews";
import { DossierTimeline } from "./DossierTimeline";

interface DossierDetailProps {
  repositoryId: string;
  login: string;
}

/**
 * Owns the writes for one open dossier so the page stays composition only.
 * Every mutation invalidates the dossier namespace, so nothing here mirrors
 * server state into local state.
 */
export function DossierDetail({ repositoryId, login }: DossierDetailProps) {
  const t = useTranslate();
  const { notify } = useToast();

  const dossier = useDossier(repositoryId, login);
  const regenerate = useRegenerateNarrative(repositoryId, login);
  const addNote = useAddNote(repositoryId, login);
  const deleteNote = useDeleteNote();

  const fail = (error: unknown) =>
    notify(t(error instanceof ApiError ? error.i18nKey : "error.unknown"), "error");

  if (!dossier.data) {
    return (
      <Card>
        <EmptyState message={t(dossier.isLoading ? "state.loading" : "dossier.empty")} />
      </Card>
    );
  }

  const record = dossier.data;

  return (
    <div className="stack">
      <DossierOverview dossier={record} />

      <DossierMedals achievements={record.achievements} />

      <DossierNarrative
        dossier={record}
        regenerating={regenerate.isPending}
        onRegenerate={() => regenerate.mutate(true, { onError: fail })}
      />

      <DossierBreakdown scoreByRule={record.scoreByRule} />
      <DossierTimeline events={record.events} />
      <DossierFiles files={record.files} enriched={record.enriched} />
      <DossierReviews reviews={record.reviews} />

      <DossierNotes
        notes={record.notes}
        busy={addNote.isPending || deleteNote.isPending}
        onAdd={(input) => addNote.mutate(input, { onError: fail })}
        onDelete={(noteId) => deleteNote.mutate(noteId, { onError: fail })}
      />
    </div>
  );
}
