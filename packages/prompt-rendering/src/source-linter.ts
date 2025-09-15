import { AuthoringValidationError } from "./errors.js";
import { RESERVED_SOURCES } from "./reserved-sources.js";
import type { PromptTemplate, SourceSpec } from "./types.js";
import { iterDataRefs } from "./walkers.js";

/**
 * Validates that all DataRef source names in a template are in the allowed list.
 * @param template - The template to validate
 * @param allowedSources - Set of allowed source names (if undefined, no validation)
 * @throws {AuthoringValidationError} if unknown source names are found
 */
export function lintSourceNames<K extends string, S extends SourceSpec>(
  template: PromptTemplate<K, S>,
  allowedSources?: Set<keyof S & string> | Set<string>
): void {
  if (!allowedSources) {
    return; // No validation if no allowed sources provided
  }

  const allowed = new Set([...allowedSources, ...RESERVED_SOURCES]);
  const usedSources = extractAllSourceNames(template);
  const unknownSources = usedSources.filter((source) => !allowed.has(source));

  if (unknownSources.length > 0) {
    throw new AuthoringValidationError(`Unknown source names found: ${unknownSources.join(", ")}`);
  }
}

/**
 * Extracts all DataRef source names from a template using the walker.
 * @param template - The template to extract from
 * @returns Array of unique source names found in the template
 */
export function extractAllSourceNames<K extends string, S extends SourceSpec>(
  template: PromptTemplate<K, S>
): Array<keyof S & string> {
  const out = new Set<keyof S & string>();
  for (const { ref } of iterDataRefs(template)) {
    out.add(ref.source as keyof S & string);
  }
  return [...out].sort();
}
