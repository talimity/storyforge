const DEBUG_STORAGE_KEY = "storyforge:debug-logs";

function isDebugLoggingEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Emits a debug-only console log that can be toggled by setting
 * `localStorage["storyforge:debug-logs"] = "1"` in production builds.
 *
 * In development builds, debug logs are always enabled.
 */
export function debugLog(namespace: string, ...args: unknown[]) {
  if (!isDebugLoggingEnabled()) return;
  console.log(`[${namespace}]`, ...args);
}

export function enableDebugLogging() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEBUG_STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

export function disableDebugLogging() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DEBUG_STORAGE_KEY);
  } catch {
    // ignore
  }
}
