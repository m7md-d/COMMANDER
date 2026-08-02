import type { SessionState } from "@commander/shared";
import { api } from "@/shared/api/client";

export const authKeys = {
  session: ["auth", "session"] as const,
};

export const authApi = {
  session: () => api.get<SessionState>("/auth/session"),
  login: (password: string) => api.post<{ authenticated: boolean }>("/auth/login", { password }),
  logout: () => api.post<{ authenticated: boolean }>("/auth/logout"),
};
