import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SettingsUpdate } from "@commander/shared";
import { settingsApi, settingsKeys } from "./api";

export function useSettings() {
  return useQuery({ queryKey: settingsKeys.all, queryFn: settingsApi.read });
}

export function useSecretStatus() {
  return useQuery({
    queryKey: settingsKeys.secrets,
    queryFn: settingsApi.secrets,
    // Secrets only change on a container restart.
    staleTime: Infinity,
  });
}

export function useUpdateSettings() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (patch: SettingsUpdate) => settingsApi.update(patch),
    onSuccess: (settings) => {
      // Seed the cache with the server's answer instead of refetching: the
      // response is already the authoritative post-write state.
      client.setQueryData(settingsKeys.all, settings);
    },
  });
}
