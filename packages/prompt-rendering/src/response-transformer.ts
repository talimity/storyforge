import { z } from "zod";

// TODO: this module is no longer used in the renderer. maybe repurposable for
// workflow runner.

/** ---------- Output Post-Processing ---------- */

export type ResponseTransform =
  | { type: "regexExtract"; pattern: string; flags?: string; group?: number } // select one capture group (default 0)
  | { type: "regexReplace"; pattern: string; flags?: string; replace: string };

export const responseTransformSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("regexExtract"),
    pattern: z.string(),
    flags: z.string().optional(),
    group: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal("regexReplace"),
    pattern: z.string(),
    flags: z.string().optional(),
    replace: z.string(),
  }),
]);

/**
 * Apply response transforms to text in sequence.
 * Transforms are applied in order and never throw - on error, text is returned unchanged.
 *
 * @param text - The text to transform
 * @param transforms - Array of transforms to apply sequentially
 * @returns Transformed text
 */
export function applyTransforms(text: string, transforms?: readonly ResponseTransform[]): string {
  if (!transforms || transforms.length === 0) {
    return text;
  }

  let result = text;
  for (const transform of transforms) {
    result = applyTransform(result, transform);
  }

  return result;
}

/**
 * Apply a single transform to text.
 * Never throws - returns text unchanged on error.
 */
function applyTransform(text: string, transform: ResponseTransform): string {
  try {
    const transformType = transform.type;
    switch (transformType) {
      case "regexExtract":
        return applyRegexExtract(text, transform);
      case "regexReplace":
        return applyRegexReplace(text, transform);
      default: {
        // Should never happen if schema is correct
        return text;
      }
    }
  } catch (_error) {
    // On any error, return text unchanged
    return text;
  }
}

/**
 * Apply regex extract transform.
 * Finds first match and returns specified capture group (default 0).
 * No match = return original text.
 */
function applyRegexExtract(
  text: string,
  transform: ResponseTransform & { type: "regexExtract" }
): string {
  try {
    const regex = new RegExp(transform.pattern, transform.flags);
    const match = regex.exec(text);

    if (!match) {
      return text; // No match found, return unchanged
    }

    const group = transform.group ?? 0; // Default to group 0 (entire match)
    const captured = match[group];

    // If the specified group doesn't exist, return unchanged
    if (captured === undefined) {
      return text;
    }

    return captured;
  } catch (_error) {
    // Invalid regex or other error - return unchanged
    return text;
  }
}

/**
 * Apply regex replace transform.
 * Performs replacement according to flags (global if 'g' present).
 * Invalid pattern = return original text.
 */
function applyRegexReplace(
  text: string,
  transform: ResponseTransform & { type: "regexReplace" }
): string {
  try {
    const regex = new RegExp(transform.pattern, transform.flags);
    return text.replace(regex, transform.replace);
  } catch (_error) {
    // Invalid regex or other error - return unchanged
    return text;
  }
}
