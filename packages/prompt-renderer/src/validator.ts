import { TemplateStructureError } from "./errors";
import type { PromptTemplate } from "./types";
import { iterMessageBlocks } from "./walkers";

/**
 * Validates the structural consistency of a prompt template.
 * @param template - The template to validate
 * @throws {TemplateStructureError} if validation fails
 */
export function validateTemplateStructure(template: PromptTemplate): void {
  validateUniqueSlotNames(template);
  validateLayoutSlotReferences(template);
  validateAssistantPrefixUsage(template);
}

/**
 * Ensures all slot names are unique.
 */
function validateUniqueSlotNames(template: PromptTemplate): void {
  const slotNames = Object.keys(template.slots);
  const uniqueNames = new Set(slotNames);

  if (slotNames.length !== uniqueNames.size) {
    throw new TemplateStructureError("Duplicate slot names found in template");
  }
}

/**
 * Ensures all layout slot references point to existing slots.
 */
function validateLayoutSlotReferences(template: PromptTemplate): void {
  const availableSlots = new Set(Object.keys(template.slots));

  for (const node of template.layout) {
    if (node.kind === "slot") {
      if (!availableSlots.has(node.name)) {
        throw new TemplateStructureError(
          `Layout references non-existent slot: "${node.name}"`
        );
      }
    }
  }
}

/**
 * Validates that prefix:true only appears on assistant role messages.
 * Uses the walker to check all message blocks including headers/footers.
 */
function validateAssistantPrefixUsage(template: PromptTemplate): void {
  for (const { block, path } of iterMessageBlocks(template)) {
    if (block.prefix === true && block.role !== "assistant") {
      throw new TemplateStructureError(
        `prefix:true can only be used with role:'assistant', found on role:'${block.role}' at ${path}`
      );
    }
  }
}
