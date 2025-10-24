import type { FilterParamConfig } from "./use-persisted-library-filters";

type StringParamOptions = {
  readonly trim?: boolean;
  readonly fallback?: string;
  readonly omitWhen?: (value: string) => boolean;
};

export function stringParam(param: string, options: StringParamOptions = {}): FilterParamConfig {
  const { trim = false, fallback = "", omitWhen } = options;
  return {
    param,
    decode: (values) => {
      const value = values[0];
      if (typeof value !== "string") {
        return fallback;
      }
      return trim ? value.trim() : value;
    },
    encode: (value) => {
      if (typeof value !== "string") {
        return [];
      }
      const candidate = trim ? value.trim() : value;
      if (omitWhen?.(candidate)) {
        return [];
      }
      return [candidate];
    },
  };
}

type BooleanParamOptions = {
  readonly trueValue?: string;
};

export function booleanParam(param: string, options: BooleanParamOptions = {}): FilterParamConfig {
  const { trueValue = "true" } = options;
  return {
    param,
    decode: (values) => values[0] === trueValue,
    encode: (value) => (value === true ? [trueValue] : []),
  };
}

type EnumParamOptions<T extends string> = {
  readonly param: string;
  readonly values: readonly T[];
  readonly fallback: T;
  readonly omitFallback?: boolean;
};

export function enumParam<T extends string>(options: EnumParamOptions<T>): FilterParamConfig {
  const { param, values, fallback, omitFallback = true } = options;
  const allowed = new Set<string>(values);
  return {
    param,
    decode: (decodedValues) => {
      const first = decodedValues[0];
      if (typeof first !== "string") {
        return fallback;
      }
      if (allowed.has(first)) {
        return first;
      }
      return fallback;
    },
    encode: (value) => {
      if (typeof value !== "string" || !allowed.has(value)) {
        return [];
      }
      if (omitFallback && value === fallback) {
        return [];
      }
      return [value];
    },
  };
}

type DelimitedArrayParamOptions<T> = {
  readonly param: string;
  readonly separator?: string;
  readonly parseItem: (value: string) => T | null;
  readonly formatItem?: (value: T) => string;
  readonly equals?: (left: T[], right: T[]) => boolean;
};

export function delimitedArrayParam<T>(options: DelimitedArrayParamOptions<T>): FilterParamConfig {
  const {
    param,
    separator = ",",
    parseItem,
    formatItem = (value: T) => String(value),
    equals = defaultArrayEquals,
  } = options;

  return {
    param,
    decode: (values) => {
      const first = values[0];
      if (typeof first !== "string" || first.length === 0) {
        return [];
      }
      const parts = first.split(separator);
      const result: T[] = [];
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length === 0) continue;
        const parsed = parseItem(trimmed);
        if (parsed !== null) {
          result.push(parsed);
        }
      }
      return result;
    },
    encode: (value) => {
      if (!Array.isArray(value) || value.length === 0) {
        return [];
      }
      return [value.map((item) => formatItem(item)).join(separator)];
    },
    equals: (left, right) => {
      if (!Array.isArray(left) || !Array.isArray(right)) {
        return false;
      }
      return equals(left as T[], right as T[]);
    },
  };
}

function defaultArrayEquals<T>(left: T[], right: T[]) {
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
