import type {
  Repository,
  RepositoryInput,
  RepositoryUpdate,
  ScanResult,
  StructureDigest,
  TreeSnapshot,
} from "@commander/shared";
import type { CheckConfigMap, CheckTemplate, CheckTemplateInput } from "@commander/shared";
import { api } from "@/shared/api/client";

export interface RepositoryListResponse {
  repositories: Repository[];
  webhookUrl: string;
}

export type { ScanResult };

export const repositoryKeys = {
  all: ["repositories"] as const,
  detail: (id: string) => ["repositories", id] as const,
  structure: (id: string) => ["repositories", id, "structure"] as const,
  tree: (id: string) => ["repositories", id, "tree"] as const,
  checkTemplates: ["check-templates"] as const,
};

export const repositoryApi = {
  list: () => api.get<RepositoryListResponse>("/repositories"),
  create: (input: RepositoryInput) => api.post<Repository>("/repositories", input),
  update: (id: string, patch: RepositoryUpdate) =>
    api.patch<Repository>(`/repositories/${id}`, patch),
  remove: (id: string) => api.delete<void>(`/repositories/${id}`),
  test: (repositoryId: string) =>
    api.post<{ deliveryId: string }>("/deliveries/test", { repositoryId }),
  digest: (repositoryId: string) =>
    api.post<{ deliveryId: string }>("/deliveries/digest", { repositoryId }),
  scan: (id: string) => api.post<ScanResult>(`/repositories/${id}/scan`, {}),
  structure: (id: string) =>
    api.get<{ structure: StructureDigest | null }>(`/repositories/${id}/structure`),
  tree: (id: string) => api.get<TreeSnapshot>(`/repositories/${id}/tree`),
};

/** The templates, plus the limits they layer over — sent together so the editor
 *  never invents a placeholder the engine would disagree with. */
export interface CheckTemplateList {
  templates: CheckTemplate[];
  defaults: CheckConfigMap;
}

export const checkTemplateApi = {
  list: () => api.get<CheckTemplateList>("/check-templates"),
  create: (input: CheckTemplateInput) => api.post<CheckTemplate>("/check-templates", input),
  update: (id: string, input: CheckTemplateInput) =>
    api.put<CheckTemplate>(`/check-templates/${id}`, input),
  remove: (id: string) => api.delete<void>(`/check-templates/${id}`),
};
