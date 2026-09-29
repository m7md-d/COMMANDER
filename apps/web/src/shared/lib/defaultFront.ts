import type { Repository } from "@commander/shared";

/**
 * The front a per-front page shows: the one chosen, or a default worth opening.
 *
 * The default is the first front that is watched and has people in it, then the
 * first watched one, then the first at all. "The first in the list" opened the
 * operations room and the dossiers on a disabled front with nobody in it — an
 * empty board, while the data sat under the next name (docs/UI-DEFECTS.md W-08).
 */
export function resolveSelected(repositories: Repository[], selected: string | null): Repository | null {
  const chosen = repositories.find((repository) => repository.id === selected);
  if (chosen) return chosen;

  const watched = repositories.filter((repository) => repository.enabled);
  return watched.find((repository) => repository.members.length > 0) ?? watched[0] ?? repositories[0] ?? null;
}
