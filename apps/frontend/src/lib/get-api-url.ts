export const getBaseUrl = () => {
  const isBrowser = typeof window !== "undefined";
  if (isBrowser) {
    // Browser should use the API running on port 3001
    return "http://localhost:3001";
  }

  // Server should use absolute URL (for SSR, though we're not doing SSR currently)
  return "http://localhost:3001";
};

// Utility to convert relative API paths to absolute URLs
export function getApiUrl(path?: string | null): string | null {
  if (!path) return null;

  if (path.startsWith("http")) {
    return path; // Already absolute
  }
  return `${getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
