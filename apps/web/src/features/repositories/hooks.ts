import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RepositoryInput, RepositoryUpdate } from "@commander/shared";
import type { CheckTemplateInput } from "@commander/shared";
import { checkTemplateApi, repositoryApi, repositoryKeys } from "./api";

export function useRepositories() {
  return useQuery({ queryKey: repositoryKeys.all, queryFn: repositoryApi.list });
}

/**
 * The cached layout digest for one front. Fetched only when its sheet is open —
 * Radix unmounts an inactive tab panel, so the request is made the first time
 * the project section is looked at and never for a front nobody opened.
 */
export function useStructure(id: string) {
  return useQuery({
    queryKey: repositoryKeys.structure(id),
    queryFn: () => repositoryApi.structure(id),
  });
}

/**
 * The stored file tree for one front, fetched on the same terms as the digest:
 * only when its sheet is open. A tree is thousands of rows, and a front nobody
 * opened must never pay for them.
 */
export function useTree(id: string) {
  return useQuery({ queryKey: repositoryKeys.tree(id), queryFn: () => repositoryApi.tree(id) });
}

/** The shared check templates and the defaults beneath them. */
export function useCheckTemplates() {
  return useQuery({ queryKey: repositoryKeys.checkTemplates, queryFn: checkTemplateApi.list });
}

/**
 * Editing a template changes what its fronts are judged by, so the repository
 * list is invalidated alongside it — a front's resolved limits are derived, and
 * a stale copy would show the old numbers beside the new template.
 */
function useTemplateMutation<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: repositoryKeys.checkTemplates });
      void client.invalidateQueries({ queryKey: repositoryKeys.all });
    },
  });
}

export function useCreateCheckTemplate() {
  return useTemplateMutation((input: CheckTemplateInput) => checkTemplateApi.create(input));
}

export function useUpdateCheckTemplate() {
  return useTemplateMutation(({ id, input }: { id: string; input: CheckTemplateInput }) =>
    checkTemplateApi.update(id, input),
  );
}

export function useDeleteCheckTemplate() {
  return useTemplateMutation((id: string) => checkTemplateApi.remove(id));
}

/**
 * Every mutation invalidates the same key, so the list is never stale after a
 * write. Generic over the result as well as the argument: creating a front
 * returns the front, and the caller navigates into it.
 */
function useRepositoryMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: repositoryKeys.all }),
  });
}

export function useCreateRepository() {
  return useRepositoryMutation((input: RepositoryInput) => repositoryApi.create(input));
}

export function useUpdateRepository() {
  return useRepositoryMutation(({ id, patch }: { id: string; patch: RepositoryUpdate }) =>
    repositoryApi.update(id, patch),
  );
}

export function useDeleteRepository() {
  return useRepositoryMutation((id: string) => repositoryApi.remove(id));
}

export function useTestDelivery() {
  return useMutation({ mutationFn: (id: string) => repositoryApi.test(id) });
}

/** Queues the digest for the window that is currently open. Nothing on this
 *  screen shows the schedule, so there is no cache here to invalidate. */
export function useSendDigest() {
  return useMutation({ mutationFn: (id: string) => repositoryApi.digest(id) });
}

/**
 * A scan writes members, so it invalidates the list — but its result is typed
 * rather than discarded, because the caller reports what was found.
 */
export function useScanRepository() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repositoryApi.scan(id),
    onSuccess: (_result, id) => {
      // All three: a scan writes members and the scan stamp onto the repository,
      // rebuilds the file tree, and rewrites the digest from it. Invalidating
      // only the list would leave the survey and the chart showing the layout
      // from before the pass that was just run.
      void client.invalidateQueries({ queryKey: repositoryKeys.all });
      void client.invalidateQueries({ queryKey: repositoryKeys.structure(id) });
      void client.invalidateQueries({ queryKey: repositoryKeys.tree(id) });
    },
  });
}
