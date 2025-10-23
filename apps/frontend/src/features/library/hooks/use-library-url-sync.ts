import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { StoreApi, UseBoundStore } from "zustand";

function defaultEquals<Value>(a: Value, b: Value): boolean {
  return Object.is(a, b);
}

interface PersistMetadata<State> {
  hasHydrated: () => boolean;
  onFinishHydration: (callback: (state: State) => void) => () => void;
}

export type PersistedUseStore<State> = UseBoundStore<StoreApi<State>> & {
  persist: PersistMetadata<State>;
};

export interface LibraryUrlParseResult<Value> {
  readonly hasValue: boolean;
  readonly value: Value;
}

export interface LibraryUrlSyncDescriptor<State, Value> {
  readonly defaultValue: Value;
  readonly select: (state: State) => Value;
  readonly parse: (params: URLSearchParams) => LibraryUrlParseResult<Value>;
  readonly serialize: (params: URLSearchParams, value: Value, defaultValue: Value) => void;
  readonly apply: (value: Value, store: PersistedUseStore<State>) => void;
  readonly equals?: (a: Value, b: Value) => boolean;
}

type SubscribeEqualityComparator<Value> = (next: Value, previous: Value) => boolean;

interface LibraryUrlSyncOptions<State> {
  readonly store: PersistedUseStore<State>;
  readonly descriptors: ReadonlyArray<LibraryUrlSyncDescriptor<State, unknown>>;
  readonly preserveUnknownParams?: boolean;
}

function useStoreHydrated<State>(store: PersistedUseStore<State>): boolean {
  const [hydrated, setHydrated] = useState(store.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) {
      return;
    }
    const unsubscribe = store.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsubscribe;
  }, [hydrated, store]);

  return hydrated;
}

function buildSubscribeEquality<State>(
  descriptors: ReadonlyArray<LibraryUrlSyncDescriptor<State, unknown>>
): SubscribeEqualityComparator<unknown[]> {
  return (next, previous) => {
    if (next.length !== previous.length) {
      return false;
    }
    for (let index = 0; index < descriptors.length; index += 1) {
      const descriptor = descriptors[index];
      const equals = descriptor.equals ?? defaultEquals;
      if (!equals(next[index], previous[index])) {
        return false;
      }
    }
    return true;
  };
}

export function useLibraryUrlSync<State>(options: LibraryUrlSyncOptions<State>): void {
  const { store, descriptors, preserveUnknownParams = true } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const hydrated = useStoreHydrated(store);

  const descriptorsMemo = useMemo(() => descriptors, [descriptors]);
  const equalityComparator = useMemo(
    () => buildSubscribeEquality(descriptorsMemo),
    [descriptorsMemo]
  );

  const paramsString = searchParams.toString();
  const paramsRef = useRef(paramsString);
  if (paramsRef.current !== paramsString) {
    paramsRef.current = paramsString;
  }

  const skipCounterRef = useRef(0);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const state = store.getState();
    const equalsList = descriptorsMemo.map((descriptor) => descriptor.equals ?? defaultEquals);
    const parseResults = descriptorsMemo.map((descriptor) => descriptor.parse(searchParams));
    const hasRelevantParams = parseResults.some((result) => result.hasValue);

    if (hasRelevantParams) {
      const updates: Array<() => void> = [];

      parseResults.forEach((result, index) => {
        if (!result.hasValue) {
          return;
        }

        const descriptor = descriptorsMemo[index];
        const parsedValue = result.value;
        const currentValue = descriptor.select(state);
        const equals = equalsList[index];
        if (!equals(parsedValue, currentValue)) {
          updates.push(() => descriptor.apply(parsedValue, store));
        }
      });

      if (updates.length > 0) {
        skipCounterRef.current += updates.length;
        for (const update of updates) {
          update();
        }
      }
      return;
    }

    const baseParams = preserveUnknownParams
      ? new URLSearchParams(paramsRef.current)
      : new URLSearchParams();

    descriptorsMemo.forEach((descriptor) => {
      const value = descriptor.select(state);
      descriptor.serialize(baseParams, value, descriptor.defaultValue);
    });

    const nextString = baseParams.toString();
    if (nextString === paramsRef.current) {
      return;
    }

    paramsRef.current = nextString;
    setSearchParams(baseParams, { replace: true });
  }, [descriptorsMemo, hydrated, preserveUnknownParams, searchParams, setSearchParams, store]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const unsubscribe = store.subscribe((state, previousState) => {
      const nextValues = descriptorsMemo.map((descriptor) => descriptor.select(state));
      const previousValues = descriptorsMemo.map((descriptor) => descriptor.select(previousState));

      if (skipCounterRef.current > 0) {
        skipCounterRef.current -= 1;
        return;
      }

      if (equalityComparator(nextValues, previousValues)) {
        return;
      }

      const baseParams = preserveUnknownParams
        ? new URLSearchParams(paramsRef.current)
        : new URLSearchParams();

      descriptorsMemo.forEach((descriptor, index) => {
        const value = nextValues[index];
        descriptor.serialize(baseParams, value, descriptor.defaultValue);
      });

      const nextString = baseParams.toString();
      if (nextString === paramsRef.current) {
        return;
      }
      paramsRef.current = nextString;
      setSearchParams(baseParams, { replace: true });
    });

    return unsubscribe;
  }, [
    descriptorsMemo,
    equalityComparator,
    hydrated,
    preserveUnknownParams,
    setSearchParams,
    store,
  ]);
}
