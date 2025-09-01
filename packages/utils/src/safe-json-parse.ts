export function safeJson<T = unknown>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null; // swallow malformed keep-alives / comments / partials
  }
}
