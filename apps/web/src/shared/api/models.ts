import type { ModelCatalog } from "@commander/shared";
import { api } from "./client";

export const modelKeys = {
  all: ["models"] as const,
};

export const modelApi = {
  list: () => api.get<ModelCatalog>("/models"),
};
