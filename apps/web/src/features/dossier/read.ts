import type { MemberDossier } from "@commander/shared";

export interface DossierReadDeps {
  fetch: (repositoryId: string, login: string) => Promise<MemberDossier>;
  refreshList: (repositoryId: string) => void;
}

/**
 * Opens one dossier.
 *
 * The server recomputes a dossier when it is opened, and stores the score it
 * returns (`getDossier`): the stored row is the roster's cache. So an open is a
 * read that writes, and the roster beside it — read before — is stale the moment
 * this returns.
 */
export async function readDossier(
  deps: DossierReadDeps,
  scope: { repositoryId: string; login: string },
): Promise<MemberDossier> {
  const dossier = await deps.fetch(scope.repositoryId, scope.login);
  // Only once it opened: a failed open stored nothing, and the list is still right.
  deps.refreshList(scope.repositoryId);
  return dossier;
}
