import type {
  Delivery,
  DeliveryBulkResult,
  DeliveryPage,
  DeliveryScope,
  DeliveryStatus,
} from "@commander/shared";
import { api } from "@/shared/api/client";

export interface DeliveryFilters {
  status?: DeliveryStatus;
  repositoryId?: string;
  scope?: DeliveryScope;
}

export const deliveryKeys = {
  all: ["deliveries"] as const,
  list: (filters: DeliveryFilters) => ["deliveries", filters] as const,
};

export const deliveryApi = {
  list: (filters: DeliveryFilters) =>
    api.get<DeliveryPage>("/deliveries", { ...filters, limit: 60 }),
  retry: (id: string) => api.post<Delivery>(`/deliveries/${id}/retry`),
  archive: (id: string) => api.post<Delivery>(`/deliveries/${id}/archive`),
  restore: (id: string) => api.post<Delivery>(`/deliveries/${id}/restore`),
  // Bulk archive matches the same filters as the active list.
  archiveAll: (filters: { status?: DeliveryStatus; repositoryId?: string }) =>
    api.post<DeliveryBulkResult>("/deliveries/archive", filters),
  purge: () => api.delete<DeliveryBulkResult>("/deliveries/archive"),
};
