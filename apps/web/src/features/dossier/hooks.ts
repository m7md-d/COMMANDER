import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NoteInput } from "@commander/shared";
import { dossierApi, dossierKeys } from "./api";
import { readDossier } from "./read";

export function useDossierList(repositoryId: string | null) {
  return useQuery({
    queryKey: dossierKeys.list(repositoryId ?? "none"),
    queryFn: () => dossierApi.list(repositoryId as string),
    enabled: repositoryId !== null,
  });
}

/** Opening one recomputes and stores its score, so the roster is refreshed after (`readDossier`). */
export function useDossier(repositoryId: string | null, login: string | null) {
  const client = useQueryClient();
  return useQuery({
    queryKey: dossierKeys.detail(repositoryId ?? "none", login ?? "none"),
    queryFn: () =>
      readDossier(
        {
          fetch: dossierApi.detail,
          refreshList: (id) => void client.invalidateQueries({ queryKey: dossierKeys.list(id) }),
        },
        { repositoryId: repositoryId as string, login: login as string },
      ),
    enabled: repositoryId !== null && login !== null,
  });
}

/**
 * Every dossier write invalidates the whole namespace rather than one key: a
 * note changes the detail, and regenerating can move the tier shown in the list.
 */
function useDossierMutation<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: dossierKeys.all }),
  });
}

export function useRegenerateNarrative(repositoryId: string, login: string) {
  return useDossierMutation((force: boolean) => dossierApi.regenerate(repositoryId, login, force));
}

export function useAddNote(repositoryId: string, login: string) {
  return useDossierMutation((input: NoteInput) => dossierApi.addNote(repositoryId, login, input));
}

export function useDeleteNote() {
  return useDossierMutation((noteId: string) => dossierApi.deleteNote(noteId));
}
