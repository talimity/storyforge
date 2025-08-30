/**
 * Thrown when an inference request fails due to provider-specific issues.
 */
export class InferenceProviderError extends Error {
  override readonly name = "InferenceProviderError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    Object.setPrototypeOf(this, InferenceProviderError.prototype);
  }
}

/**
 * Thrown when an inference provider cannot be used to fulfill a
 * ChatCompletionRequest due to a capability mismatch.
 */
export class InferenceProviderCompatibilityError extends Error {
  override readonly name = "InferenceProviderCompatibilityError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, InferenceProviderCompatibilityError.prototype);
  }
}

// TODO: Define more specific error types for different provider issues
// recoverable (e.g. rate limiting, temporary unavailability) vs unrecoverable
// (e.g. invalid API key, unsupported model, quota exceeded, safety)

export function bubbleProviderError(err: unknown, message: string): never {
  // Preserve previously-normalized provider errors
  if (err instanceof InferenceProviderError) throw err;

  // Map AbortError
  // (don't check for DOMException specifically as this package is isomorphic)
  if (err instanceof Error && err.name === "AbortError") {
    throw new InferenceProviderError("Request aborted by caller");
  }

  // For eerything else wrap once with a cause
  throw new InferenceProviderError(message, { cause: err });
}
