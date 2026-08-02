import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeliveryStatus } from "@commander/shared";
import { deliveryApi, deliveryKeys, type DeliveryFilters } from "./api";

export function useDeliveries(filters: DeliveryFilters) {
  return useQuery({
    queryKey: deliveryKeys.list(filters),
    queryFn: () => deliveryApi.list(filters),
    // Queued work moves without user action, so this is the one list that
    // refreshes on its own.
    refetchInterval: 15_000,
  });
}

/**
 * Every archive mutation invalidates the whole deliveries namespace: a row
 * moving between the active and archived shelves changes both lists, and a bulk
 * action changes counts a single-key invalidation would miss.
 */
function useDeliveryMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: deliveryKeys.all }),
  });
}

export function useRetryDelivery() {
  return useDeliveryMutation((id: string) => deliveryApi.retry(id));
}

export function useArchiveDelivery() {
  return useDeliveryMutation((id: string) => deliveryApi.archive(id));
}

export function useRestoreDelivery() {
  return useDeliveryMutation((id: string) => deliveryApi.restore(id));
}

export function useArchiveAll() {
  return useDeliveryMutation((filters: { status?: DeliveryStatus; repositoryId?: string }) =>
    deliveryApi.archiveAll(filters),
  );
}

export function usePurgeArchive() {
  return useDeliveryMutation(() => deliveryApi.purge());
}
