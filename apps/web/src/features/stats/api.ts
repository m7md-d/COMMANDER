import type { MemberStat, OverviewStats } from "@commander/shared";
import { api } from "@/shared/api/client";

export const statsKeys = {
  overview: ["stats", "overview"] as const,
  members: (repositoryId: string) => ["stats", "members", repositoryId] as const,
};

export const statsApi = {
  overview: () => api.get<OverviewStats>("/stats/overview"),
  members: (repositoryId: string) => api.get<MemberStat[]>(`/stats/repositories/${repositoryId}`),
  reset: (repositoryId: string) =>
    api.delete<{ deleted: number }>(`/stats/repositories/${repositoryId}`),
};
