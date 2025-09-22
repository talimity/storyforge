// Utility to convert relative API paths to absolute URLs
export function getApiUrl(path?: string | null): string | null {
  if (!path) return null;

  if (path.startsWith("http")) {
    return path; // Already absolute
  }
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}
