import { AuthoringValidationError } from "./errors";
import type { PromptTemplate } from "./types";
import { iterDataRefs } from "./walkers";

/**
 * Validates that all DataRef source names in a template are in the allowed list.
 * @param template - The template to validate
 * @param allowedSources - Set of allowed source names (if undefined, no validation)
 * @throws {AuthoringValidationError} if unknown source names are found
 */
export function lintSourceNames(
  template: PromptTemplate,
  allowedSources?: Set<string>
): void {
  if (!allowedSources) {
    return; // No validation if no allowed sources provided
  }

  const usedSources = extractAllSourceNames(template);
  const unknownSources = usedSources.filter(
    (source) => !allowedSources.has(source)
  );

  if (unknownSources.length > 0) {
    throw new AuthoringValidationError(
      `Unknown source names found: ${unknownSources.join(", ")}`
    );
  }
}

/**
 * Extracts all DataRef source names from a template using the walker.
 * @param template - The template to extract from
 * @returns Array of unique source names found in the template
 */
export function extractAllSourceNames(template: PromptTemplate): string[] {
  const sources = new Set<string>();

  for (const { ref } of iterDataRefs(template)) {
    sources.add(ref.source);
  }

  return Array.from(sources).sort();
}
