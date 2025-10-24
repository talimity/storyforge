import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { z } from "zod";

type FilterParamConfig = {
  readonly param: string;
  readonly decode?: (values: string[]) => unknown;
  readonly encode?: (value: unknown) => string[];
  readonly equals?: (left: unknown, right: unknown) => boolean;
  readonly shouldPersist?: (value: unknown, defaultValue: unknown) => boolean;
};

type FilterParamConfigMap = Record<string, FilterParamConfig | undefined>;

type PersistedSource = "url" | "storage" | "default";

interface UsePersistedLibraryFiltersOptions<Filters extends Record<string, unknown>> {
  readonly schema: z.ZodType<Filters>;
  readonly defaults: Filters;
  readonly params: FilterParamConfigMap;
  readonly storageKey: string;
  readonly version: number;
}

interface UsePersistedLibraryFiltersResult<Filters extends Record<string, unknown>> {
  readonly filters: Filters;
  readonly source: PersistedSource;
  readonly isDirty: boolean;
  setFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]): void;
  updateFilters(updater: (previous: Filters) => Filters): void;
  clearFilters(): void;
}

function defaultDecode(values: string[]) {
  return values[0];
}

function defaultEncode(value: unknown) {
  if (value === undefined || value === null) {
    return [];
  }
  return [String(value)];
}

function arraysEqual(left: unknown[], right: unknown[]) {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (!Object.is(left[index], right[index])) {
      return false;
    }
  }
  return true;
}

function defaultEquals(left: unknown, right: unknown) {
  if (Array.isArray(left) && Array.isArray(right)) {
    return arraysEqual(left, right);
  }
  return Object.is(left, right);
}

function defaultShouldPersist(
  value: unknown,
  defaultValue: unknown,
  equals: (a: unknown, b: unknown) => boolean
) {
  return !equals(value, defaultValue);
}

function cloneFilters<Filters extends Record<string, unknown>>(
  schema: z.ZodType<Filters>,
  source: Filters
) {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    raw[key] = value;
  }
  return schema.parse(raw);
}

function areFiltersEqual<Filters extends Record<string, unknown>>(
  left: Filters,
  right: Filters,
  params: FilterParamConfigMap
) {
  const rightRecord: Record<string, unknown> = right;
  for (const [key, value] of Object.entries(left)) {
    const config = params[key];
    const equals = config?.equals ?? defaultEquals;
    if (!equals(value, rightRecord[key])) {
      return false;
    }
  }
  return true;
}

function encodeParams<Filters extends Record<string, unknown>>(
  filters: Filters,
  defaults: Filters,
  params: FilterParamConfigMap,
  current: URLSearchParams
) {
  const next = new URLSearchParams(current);
  const filterRecord: Record<string, unknown> = filters;
  const defaultRecord: Record<string, unknown> = defaults;
  for (const [key, configMaybe] of Object.entries(params)) {
    if (!configMaybe) {
      continue;
    }
    const config = configMaybe;
    next.delete(config.param);
    const value = filterRecord[key];
    const defaultValue = defaultRecord[key];
    const equals = config.equals ?? defaultEquals;
    const shouldPersist =
      config.shouldPersist ??
      ((candidate: unknown, base: unknown) => defaultShouldPersist(candidate, base, equals));
    if (!shouldPersist(value, defaultValue)) {
      continue;
    }
    const encode = config.encode ?? defaultEncode;
    const encoded = encode(value);
    for (const part of encoded) {
      next.append(config.param, part);
    }
  }
  return next;
}

function parseSearchParams<Filters extends Record<string, unknown>>(
  schema: z.ZodType<Filters>,
  defaults: Filters,
  params: FilterParamConfigMap,
  searchParams: URLSearchParams
) {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(defaults)) {
    raw[key] = value;
  }

  let hasAny = false;
  for (const [key, configMaybe] of Object.entries(params)) {
    if (!configMaybe) {
      continue;
    }
    const config = configMaybe;
    const values = searchParams.getAll(config.param);
    if (values.length === 0) {
      continue;
    }
    const decode = config.decode ?? defaultDecode;
    const decoded = decode(values);
    if (decoded === undefined) {
      continue;
    }
    raw[key] = decoded;
    hasAny = true;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { filters: cloneFilters(schema, defaults), hasAny: false };
  }
  return { filters: parsed.data, hasAny };
}

function readStoredFilters<Filters extends Record<string, unknown>>(
  schema: z.ZodType<Filters>,
  storageKey: string,
  version: number
) {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const value = window.localStorage.getItem(storageKey);
    if (!value) {
      return null;
    }
    const parsedJson = JSON.parse(value);
    if (typeof parsedJson !== "object" || parsedJson === null) {
      return null;
    }
    if (parsedJson.version !== version) {
      return null;
    }
    const filters = schema.safeParse(parsedJson.filters);
    if (!filters.success) {
      return null;
    }
    return filters.data;
  } catch {
    return null;
  }
}

function writeStoredFilters<Filters extends Record<string, unknown>>(
  filters: Filters,
  storageKey: string,
  version: number
) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload = JSON.stringify({ version, filters });
    window.localStorage.setItem(storageKey, payload);
  } catch {
    // Ignore storage errors
  }
}

export function usePersistedLibraryFilters<Filters extends Record<string, unknown>>(
  options: UsePersistedLibraryFiltersOptions<Filters>
): UsePersistedLibraryFiltersResult<Filters> {
  const { schema, defaults, params, storageKey, version } = options;
  const parsedDefaults = schema.parse(defaults);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUrlResult = parseSearchParams(schema, parsedDefaults, params, searchParams);
  const storedFilters = initialUrlResult.hasAny
    ? null
    : readStoredFilters(schema, storageKey, version);
  const initialFilters = initialUrlResult.hasAny
    ? initialUrlResult.filters
    : (storedFilters ?? cloneFilters(schema, parsedDefaults));
  const initialSource: PersistedSource = initialUrlResult.hasAny
    ? "url"
    : storedFilters
      ? "storage"
      : "default";

  const [filters, setFilters] = useState(initialFilters);
  const [source, setSource] = useState(initialSource);
  const lastSyncedSearch = useRef(searchParams.toString());
  const pendingInitialSync = useRef(initialSource === "storage");

  useEffect(() => {
    if (pendingInitialSync.current) {
      const nextParams = encodeParams(filters, parsedDefaults, params, searchParams);
      const nextString = nextParams.toString();
      pendingInitialSync.current = false;
      lastSyncedSearch.current = nextString;
      setSearchParams(nextParams, { replace: true });
    }
  }, [filters, parsedDefaults, params, searchParams, setSearchParams]);

  useEffect(() => {
    writeStoredFilters(filters, storageKey, version);
  }, [filters, storageKey, version]);

  useEffect(() => {
    const currentString = searchParams.toString();
    if (currentString === lastSyncedSearch.current) {
      return;
    }
    lastSyncedSearch.current = currentString;
    const parsed = parseSearchParams(schema, parsedDefaults, params, searchParams);
    if (parsed.hasAny) {
      if (areFiltersEqual(filters, parsed.filters, params)) {
        return;
      }
      setFilters(parsed.filters);
      setSource("url");
      return;
    }
    const stored = readStoredFilters(schema, storageKey, version);
    const nextFilters = stored ?? cloneFilters(schema, parsedDefaults);
    if (areFiltersEqual(filters, nextFilters, params)) {
      return;
    }
    setFilters(nextFilters);
    setSource(stored ? "storage" : "default");
  }, [filters, params, parsedDefaults, schema, searchParams, storageKey, version]);

  const updateFilters = (updater: (previous: Filters) => Filters) => {
    setFilters((previous) => {
      const next = updater(previous);
      if (areFiltersEqual(previous, next, params)) {
        return previous;
      }
      const nextParams = encodeParams(next, parsedDefaults, params, searchParams);
      const nextString = nextParams.toString();
      lastSyncedSearch.current = nextString;
      setSearchParams(nextParams);
      setSource("default");
      return next;
    });
  };

  const setFilter = <Key extends keyof Filters>(key: Key, value: Filters[Key]) => {
    updateFilters((previous) => {
      const entries = Object.entries(previous);
      const raw: Record<string, unknown> = {};
      for (const [entryKey, entryValue] of entries) {
        raw[entryKey] = entryValue;
      }
      raw[String(key)] = value;
      return schema.parse(raw);
    });
  };

  const clearFilters = () => {
    updateFilters(() => cloneFilters(schema, parsedDefaults));
  };

  const isDirty = !areFiltersEqual(filters, parsedDefaults, params);

  return {
    filters,
    source,
    isDirty,
    setFilter,
    updateFilters,
    clearFilters,
  };
}

export type {
  FilterParamConfig,
  FilterParamConfigMap,
  UsePersistedLibraryFiltersOptions,
  UsePersistedLibraryFiltersResult,
};
