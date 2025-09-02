export function assertDefined<T>(
  value: T,
  error?: string | Error
): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    if (error instanceof Error) throw error;
    throw new Error(error ?? "Value is not defined");
  }
}
