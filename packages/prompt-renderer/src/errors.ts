/**
 * Custom error types for prompt template authoring and rendering.
 */

/**
 * Thrown when a template has structural problems (e.g., references to non-existent slots).
 */
export class TemplateStructureError extends Error {
  override readonly name = "TemplateStructureError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, TemplateStructureError.prototype);
  }
}

/**
 * Thrown when a template references unknown source names during authoring-time validation.
 */
export class AuthoringValidationError extends Error {
  override readonly name = "AuthoringValidationError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, AuthoringValidationError.prototype);
  }
}

/**
 * Thrown for unexpected runtime errors during rendering.
 */
export class RenderError extends Error {
  override readonly name = "RenderError";

  constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    Object.setPrototypeOf(this, RenderError.prototype);
  }
}
