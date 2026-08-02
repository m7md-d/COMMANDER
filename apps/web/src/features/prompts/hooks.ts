import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PreviewRequest, PromptInput } from "@commander/shared";
import { promptApi, promptKeys } from "./api";

export function usePrompts() {
  return useQuery({ queryKey: promptKeys.all, queryFn: promptApi.list });
}

function usePromptMutation<TArgs>(mutationFn: (args: TArgs) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: promptKeys.all }),
  });
}

export function useCreatePrompt() {
  return usePromptMutation((input: PromptInput) => promptApi.create(input));
}

export function useUpdatePrompt() {
  return usePromptMutation(({ id, input }: { id: string; input: PromptInput }) =>
    promptApi.update(id, input),
  );
}

export function useDeletePrompt() {
  return usePromptMutation((id: string) => promptApi.remove(id));
}

/** A mutation rather than a query: it has a cost and must only run on demand. */
export function usePreview() {
  return useMutation({ mutationFn: (request: PreviewRequest) => promptApi.preview(request) });
}
