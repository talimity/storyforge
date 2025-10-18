import { TemplateStructureError } from "./errors.js";
import type { PromptTemplate, SourceSpec } from "./types.js";

/**
 * Validates the structural consistency of a prompt template.
 * @param template - The template to validate
 * @throws {TemplateStructureError} if validation fails
 */
export function validateTemplateStructure<K extends string, S extends SourceSpec>(
  template: PromptTemplate<K, S>
): void {
  validateUniqueSlotNames(template);
  validateLayoutSlotReferences(template);
}

/**
 * Ensures all slot names are unique.
 */
function validateUniqueSlotNames<K extends string, S extends SourceSpec>(
  template: PromptTemplate<K, S>
): void {
  const slotNames = Object.keys(template.slots);
  const uniqueNames = new Set(slotNames);

  if (slotNames.length !== uniqueNames.size) {
    throw new TemplateStructureError("Duplicate slot names found in template");
  }
}

/**
 * Ensures all layout slot references point to existing slots.
 */
function validateLayoutSlotReferences<K extends string, S extends SourceSpec>(
  template: PromptTemplate<K, S>
): void {
  const availableSlots = new Set(Object.keys(template.slots));

  for (const node of template.layout) {
    if (node.kind === "slot") {
      if (!availableSlots.has(node.name)) {
        throw new TemplateStructureError(`Layout references non-existent slot: "${node.name}"`);
      }
    }
  }
}
