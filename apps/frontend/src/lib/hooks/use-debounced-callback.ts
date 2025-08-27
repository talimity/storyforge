import { useCallback, useRef } from "react";

/**
 * Hook that returns a debounced version of the provided callback function
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;
}
