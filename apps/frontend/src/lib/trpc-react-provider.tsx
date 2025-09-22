import type { AppRouter } from "@storyforge/backend";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  httpBatchLink,
  httpSubscriptionLink,
  loggerLink,
  splitLink,
} from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { getApiUrl } from "@/lib/get-api-url";
import { makeQueryClient } from "@/lib/query-client";
import { TRPCProvider } from "@/lib/trpc";

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

interface TRPCReactProviderProps {
  children: React.ReactNode;
}

export function TRPCReactProvider({ children }: TRPCReactProviderProps) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        ...(import.meta.env.DEV
          ? [
              loggerLink({
                enabled: (opts) =>
                  (opts.direction === "down" && opts.result instanceof Error) ||
                  opts.direction === "up",
              }),
            ]
          : []),
        splitLink({
          condition: (op) => op.type === "subscription",
          true: httpSubscriptionLink({ url: getApiUrl(`/trpc`) || "", transformer: superjson }),
          false: httpBatchLink({ url: getApiUrl(`/trpc`) || "", transformer: superjson }),
        }),
      ],
    })
  );

  return (
    <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        {/* Add React Query Devtools in development */}
        {/*{import.meta.env.DEV && (*/}
        {/*  <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />*/}
        {/*)}*/}
      </QueryClientProvider>
    </TRPCProvider>
  );
}
