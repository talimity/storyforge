type NonNull<T> = T extends null ? never : T extends object ? { [K in keyof T]: NonNull<T[K]> } : T;

/**
 * Drizzle ORM returns null for values that are not set, which is not ideal for
 * ergonomics as it is not compatible with optional fields. This function
 * removes null values from an object recursively.
 *
 * https://github.com/drizzle-team/drizzle-orm/issues/2745
 */
export const stripNulls = <T>(obj: T): NonNull<T> => {
  if (!!obj && typeof obj === "object" && !Array.isArray(obj)) {
    // Process object entries recursively
    return Object.entries(obj).reduce(
      (acc, [key, value]) => {
        const cleanedValue = stripNulls(value);
        if (cleanedValue !== null) {
          // biome-ignore lint/suspicious/noExplicitAny: Safe cast since we're building a new object
          (acc as any)[key] = cleanedValue;
        }
        return acc;
      },
      {} as NonNull<T>
    );
  } else if (Array.isArray(obj)) {
    // Process each array element recursively
    return obj.map((item) => stripNulls(item)) as NonNull<T>;
  }

  // Return other primitives as-is
  return obj as NonNull<T>;
};
