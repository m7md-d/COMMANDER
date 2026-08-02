import type { DossierNote, DossierSummary, MemberDossier, NoteInput } from "@commander/shared";
import { api } from "@/shared/api/client";

export const dossierKeys = {
  all: ["dossiers"] as const,
  list: (repositoryId: string) => ["dossiers", "list", repositoryId] as const,
  detail: (repositoryId: string, login: string) => ["dossiers", "detail", repositoryId, login] as const,
};

interface RegenerateResult {
  regenerated: boolean;
  dossier: MemberDossier;
}

export const dossierApi = {
  list: (repositoryId: string) => api.get<DossierSummary[]>(`/dossiers/${repositoryId}`),

  detail: (repositoryId: string, login: string) =>
    api.get<MemberDossier>(`/dossiers/${repositoryId}/${login}`),

  regenerate: (repositoryId: string, login: string, force: boolean) =>
    api.post<RegenerateResult>(`/dossiers/${repositoryId}/${login}/regenerate`, { force }),

  addNote: (repositoryId: string, login: string, input: NoteInput) =>
    api.post<DossierNote>(`/dossiers/${repositoryId}/${login}/notes`, input),

  deleteNote: (noteId: string) => api.delete<void>(`/dossiers/notes/${noteId}`),
};
