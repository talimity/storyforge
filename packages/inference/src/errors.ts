/**
 * Thrown when an inference request fails due to provider-specific issues.
 */
export class InferenceProviderError extends Error {
  override readonly name = "InferenceProviderError";

  constructor(message: string) {
    super(message);
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
