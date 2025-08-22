import type { AppRouter } from "@storyforge/backend";
import { createTRPCReact, httpBatchLink, loggerLink } from "@trpc/react-query";
import superjson from "superjson";

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
        transformer: superjson,
        url: `${getBaseUrl()}/trpc`,
      }),
    ],
  });
}

// Utility to convert relative API paths to absolute URLs
export function getApiUrl(path?: string | null): string | null {
  if (!path) return null;

  if (path.startsWith("http")) {
    return path; // Already absolute
  }
  return `${getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
