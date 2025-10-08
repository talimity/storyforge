import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

interface HydratedSearchParamsOptions<State> {
  storageKey: string;
  hasRelevantParams: (params: URLSearchParams) => boolean;
  parseStoredState: (raw: unknown) => State | null;
  applyStoredState: (params: URLSearchParams, stored: State) => void;
}

interface HydratedSearchParams<State> {
  isHydrated: boolean;
  searchParams: URLSearchParams;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
  searchParamsString: string;
  storedState: State | null;
}

export function useHydratedSearchParams<State>(
  options: HydratedSearchParamsOptions<State>
): HydratedSearchParams<State> {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();
  const initialisedRef = useRef(false);
  const [isHydrated, setHydrated] = useState(false);
  const storedStateRef = useRef<State | null | undefined>(undefined);
  const hasRelevantParams = options.hasRelevantParams(searchParams);

  if (storedStateRef.current === undefined) {
    if (typeof window === "undefined" || hasRelevantParams) {
      storedStateRef.current = null;
    } else {
      try {
        const raw = window.localStorage.getItem(options.storageKey);
        if (!raw) {
          storedStateRef.current = null;
        } else {
          storedStateRef.current = options.parseStoredState(JSON.parse(raw));
        }
      } catch (error) {
        console.error(error);
        storedStateRef.current = null;
      }
    }
  }

  useEffect(() => {
    if (initialisedRef.current) {
      if (!isHydrated) {
        setHydrated(true);
      }
      return;
    }

    if (typeof window === "undefined") {
      initialisedRef.current = true;
      setHydrated(true);
      return;
    }

    if (hasRelevantParams) {
      initialisedRef.current = true;
      setHydrated(true);
      return;
    }

    let storedState = storedStateRef.current;
    if (storedState === undefined) {
      try {
        const raw = window.localStorage.getItem(options.storageKey);
        if (raw) {
          storedState = options.parseStoredState(JSON.parse(raw));
        } else {
          storedState = null;
        }
      } catch (error) {
        console.error(error);
        storedState = null;
      }
      storedStateRef.current = storedState;
    }

    initialisedRef.current = true;
    setHydrated(true);

    if (!storedState) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    options.applyStoredState(nextParams, storedState);

    if (nextParams.toString() !== searchParamsString) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [hasRelevantParams, isHydrated, options, searchParams, searchParamsString, setSearchParams]);

  return {
    isHydrated,
    searchParams,
    setSearchParams,
    searchParamsString,
    storedState: storedStateRef.current ?? null,
  };
}
