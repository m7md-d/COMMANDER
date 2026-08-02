import { useQuery } from "@tanstack/react-query";
import { modelApi, modelKeys } from "@/shared/api/models";

export function useModels() {
  return useQuery({
    queryKey: modelKeys.all,
    queryFn: modelApi.list,
    // The catalogue changes on the order of days and the server caches it too,
    // so treat a fetched list as fresh for the whole session.
    staleTime: 30 * 60 * 1_000,
  });
}
