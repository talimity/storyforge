import type { PromptTemplate as DbTemplate } from "@storyforge/db";
import {
  parseTemplate,
  type PromptTemplate as SpecPromptTemplate,
} from "@storyforge/prompt-renderer";
import { ServiceError } from "@/service-error";

export function fromDbPromptTemplate(template: DbTemplate): SpecPromptTemplate {
  // Build object from database types and validate through schema
  const templateData = {
    id: template.id,
    task: template.task,
    name: template.name,
    version: template.version,
    layout: template.layout,
    slots: template.slots,
    responseFormat: template.responseFormat,
    responseTransforms: template.responseTransforms,
  };

  try {
    return parseTemplate(templateData);
  } catch (error) {
    throw new ServiceError("InvalidInput", {
      message: `Database template validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
