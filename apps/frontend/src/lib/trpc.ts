import { createTRPCReact, httpBatchLink, loggerLink } from "@trpc/react-query";
import type { AppRouter } from "../../../backend/src/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const isBrowser = typeof window !== "undefined";
  if (isBrowser) {
    // Browser should use the API running on port 3001
    return "http://localhost:3001";
  }

  // Server should use absolute URL (for SSR, though we're not doing SSR currently)
  return "http://localhost:3001";
};

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      // Add logging in development
      ...(import.meta.env.DEV
        ? [
            loggerLink({
              enabled: (opts) =>
                (opts.direction === "down" && opts.result instanceof Error) ||
                opts.direction === "up",
            }),
          ]
        : []),
      httpBatchLink({
        url: `${getBaseUrl()}/trpc`,

        fetch(url, options) {
          return fetch(url, { ...options });
        },
      }),
    ],
  });
}
