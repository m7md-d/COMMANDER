import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/client";

/**
 * One client for the app. The retry policy is the important part: a 4xx means
 * the request was wrong, so repeating it verbatim is pure latency. Only
 * transport and 5xx failures are worth another attempt.
 */
export const queryClient = new QueryClient({
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
