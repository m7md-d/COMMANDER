import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionState } from "@commander/shared";
import { authApi, authKeys } from "./api";

export function useSession() {
  return useQuery({
    queryKey: authKeys.session,
    queryFn: authApi.session,
    // The session is the gate for the whole app; a stale "authenticated" would
    // render the shell and then 401 everywhere.
    staleTime: 0,
    retry: false,
  });
}

export function useLogin() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (password: string) => authApi.login(password),
    onSuccess: () => client.invalidateQueries({ queryKey: authKeys.session }),
  });
}

export function useLogout() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      // Everything cached was fetched under the old session; keeping any of it
      // would leak the previous view.
      client.clear();
      // clear() leaves the session query with no data, so nothing re-renders
      // and the signed-out state never shows — the "logout button stays"
      // bug. Seed the unauthenticated state so the shell reacts at once, then
      // let the next fetch confirm it.
      client.setQueryData<SessionState>(authKeys.session, (prev) => ({
        authenticated: false,
        configured: prev?.configured ?? true,
      }));
    },
  });
}
