import { useState } from "react";
import type {
  MemberInput,
  Repository,
  RepositoryUpdate,
  RuleConfigMap,
} from "@commander/shared";

/**
 * The edits held for one front. Two slots are narrowed against
 * `RepositoryUpdate`, and the narrowing is what keeps this file cast-free:
 *
 *   rules   — the update contract accepts a *partial* map, but the panel always
 *             edits the complete one the API returns. Storing the complete map
 *             means the merged value is a RuleConfigMap without a cast, and it
 *             is still assignable to the contract on save.
 *   members — the contract's MemberInput, not the returned Member, because the
 *             roster panel adds rows that have no id yet.
 */
export type FrontChanges = Omit<RepositoryUpdate, "rules" | "members"> & {
  rules?: RuleConfigMap;
  members?: MemberInput[];
};

/** The front as the panels see it: server state with the pending edits applied. */
export type FrontValue = Omit<Repository, "members"> & { members: MemberInput[] };

export interface FrontDraft {
  value: FrontValue;
  changes: FrontChanges;
  dirty: boolean;
  patch: <K extends keyof FrontChanges>(key: K, next: FrontChanges[K]) => void;
  reset: () => void;
}

/**
 * A single draft for the whole file rather than one per section.
 *
 * The sections are tabs of one document, so an edit on "project" must survive a
 * look at "rules" — a per-tab draft would silently discard it, which is the
 * failure the tab layout would otherwise introduce. One draft also means one
 * save bar and one PATCH carrying everything that actually changed.
 *
 * There is no effect resetting on a new front: the caller mounts this per id,
 * so switching fronts unmounts the draft with it and no stale edit can leak
 * across (web CONSTITUTION §5 — one useEffect, and here none is needed).
 */
export function useFrontDraft(repository: Repository): FrontDraft {
  const [changes, setChanges] = useState<FrontChanges>({});

  const value: FrontValue = {
    ...repository,
    ...changes,
    rules: changes.rules ?? repository.rules,
    members: changes.members ?? repository.members,
  };

  return {
    value,
    changes,
    dirty: Object.keys(changes).length > 0,
    patch: (key, next) => setChanges((current) => ({ ...current, [key]: next })),
    reset: () => setChanges({}),
  };
}
