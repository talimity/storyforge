import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        retry(failureCount, error) {
          if (error instanceof TRPCClientError) {
            // Don't retry for 4xx errors
            if (Number(error.data?.httpStatus) < 500) {
              return false;
            }
          }
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: { retry: 0 },
      // No SSR currently so dehydration is not used
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}
