import { useQuery } from "@tanstack/react-query";
import { settingsApi, settingsKeys } from "@/shared/api/settings";

/**
 * The operator's settings, read wherever a screen needs one of them — shared
 * because more than one feature does (a provider's refusal reads whether its
 * raw reply may be shown). Written only from the settings feature.
 */
export function useSettings() {
  return useQuery({ queryKey: settingsKeys.all, queryFn: settingsApi.read });
}
