import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { SessionState } from "@commander/shared";
import { authKeys } from "@/features/auth/api";
import { ApiError } from "@/shared/api/client";
import { sessionEnded } from "./session-ended";

/**
 * A 401 while signed in means the session ended: ask the server again, and the
 * answer — signed out — sends every guarded route to the login page. Without
 * this each page offered "retry" beside "the session ended", a 401 every time
 * (docs/UI-DEFECTS.md W-22).
 */
function recheckSession(error: Error): void {
  const signedIn = queryClient.getQueryData<SessionState>(authKeys.session)?.authenticated === true;
  const status = error instanceof ApiError ? error.status : undefined;
  if (sessionEnded({ status, signedIn })) void queryClient.invalidateQueries({ queryKey: authKeys.session });
}

/**
 * One client for the app. The retry policy is the important part: a 4xx means
 * the request was wrong, so repeating it verbatim is pure latency. Only
 * transport and 5xx failures are worth another attempt.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: recheckSession }),
  mutationCache: new MutationCache({ onError: recheckSession }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
