import { defaultShouldDehydrateQuery, MutationCache, QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { toaster } from "@/components/ui";

export function makeQueryClient() {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => {
        if (error instanceof TRPCClientError) {
          // Handle TRPC client errors globally
          toaster.error({
            description: error.message,
            title: "Request failed",
          });
        }
      },
    }),
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
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}
