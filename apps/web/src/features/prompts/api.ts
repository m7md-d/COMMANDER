import type { PreviewRequest, PreviewResult, Prompt, PromptInput } from "@commander/shared";
import { api } from "@/shared/api/client";

export interface PromptListResponse {
  prompts: Prompt[];
  variables: readonly string[];
}

export interface PromptWriteResponse {
  prompt: Prompt;
  /** False when the system prompt no longer mentions the untrusted-data tag. */
  guardRetained: boolean;
}

export const promptKeys = {
  all: ["prompts"] as const,
};

export const promptApi = {
  list: () => api.get<PromptListResponse>("/prompts"),
  create: (input: PromptInput) => api.post<PromptWriteResponse>("/prompts", input),
  update: (id: string, input: PromptInput) => api.put<PromptWriteResponse>(`/prompts/${id}`, input),
  remove: (id: string) => api.delete<void>(`/prompts/${id}`),
  preview: (request: PreviewRequest) => api.post<PreviewResult>("/deliveries/preview", request),
};
