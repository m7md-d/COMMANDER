import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { statsApi, statsKeys } from "./api";

export function useOverviewStats() {
  return useQuery({ queryKey: statsKeys.overview, queryFn: statsApi.overview });
}

export function useMemberStats(repositoryId: string | null) {
  return useQuery({
    queryKey: statsKeys.members(repositoryId ?? "none"),
    queryFn: () => statsApi.members(repositoryId as string),
    // Nothing to fetch until a repository is selected.
    enabled: repositoryId !== null,
  });
}

export function useResetStats() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (repositoryId: string) => statsApi.reset(repositoryId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["stats"] }),
  });
}
