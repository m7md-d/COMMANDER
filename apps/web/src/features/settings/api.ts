import type { SecretStatus, Settings, SettingsUpdate } from "@commander/shared";
import { api } from "@/shared/api/client";

export const settingsKeys = {
  all: ["settings"] as const,
  secrets: ["settings", "secrets"] as const,
};

export const settingsApi = {
  read: () => api.get<Settings>("/settings"),
  update: (patch: SettingsUpdate) => api.patch<Settings>("/settings", patch),
  secrets: () => api.get<SecretStatus>("/settings/secrets"),
};
