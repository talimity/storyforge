import { z } from "zod";
import type { RecipeParamSpec } from "../recipes/contract";
import type { LayoutNodeDraft, SlotDraft } from "../types";
import type { TemplateVariable } from "./template-string-editor";

/**
 * Validation schema for slot priority
 */
export const slotPrioritySchema = z
  .number()
  .int()
  .min(0, "Priority must be 0 or greater")
  .max(10, "Priority must be 10 or less");

/**
 * Validation schema for slot budget
 */
export const slotBudgetSchema = z
  .number()
  .int()
  .min(50, "Budget must be at least 50 tokens")
  .max(5000, "Budget must not exceed 5000 tokens")
  .optional();

/**
 * Validation schema for slot name
 */
export const slotNameSchema = z
  .string()
  .min(1, "Slot name is required")
  .max(50, "Slot name must be 50 characters or less")
  .regex(
    /^[a-zA-Z][a-zA-Z0-9_]*$/,
    "Slot name must start with a letter and contain only letters, numbers, and underscores"
  );

/**
 * Create a validation schema for a specific parameter
 */
export function createParameterSchema(
  param: RecipeParamSpec
): z.ZodSchema<unknown> {
  switch (param.type) {
    case "number": {
      let numberSchema = z.number();

      if (param.min !== undefined) {
        numberSchema = numberSchema.min(
          param.min,
          `${param.label} must be at least ${param.min}`
        );
      }

      if (param.max !== undefined) {
        numberSchema = numberSchema.max(
          param.max,
          `${param.label} must be at most ${param.max}`
        );
      }

      return numberSchema;
    }

    case "select": {
      if (!param.options || param.options.length === 0) {
        return z.string();
      }

      const validValues = param.options.map((opt) => opt.value);
      return z
        .union([z.string(), z.number(), z.boolean()])
        .refine((value) => validValues.includes(value), {
          message: `${param.label} must be one of: ${validValues.join(", ")}`,
        });
    }

    case "toggle":
      return z.boolean();

    case "template_string":
      return z.string().min(1, `${param.label} cannot be empty`);

    default:
      return z.unknown();
  }
}

/**
 * Create a validation schema for all parameters of a recipe
 */
export function createRecipeParametersSchema(
  parameters: RecipeParamSpec[]
): z.ZodSchema<Record<string, unknown>> {
  const schemaShape: Record<string, z.ZodSchema<unknown>> = {};

  for (const param of parameters) {
    schemaShape[param.key] = createParameterSchema(param);
  }

  return z.object(schemaShape);
}

/**
 * Validation schema for a complete slot draft
 */
export const slotDraftSchema = z.object({
  recipeId: z.string().min(1, "Recipe ID is required"),
  name: slotNameSchema,
  priority: slotPrioritySchema,
  budget: slotBudgetSchema,
  params: z.record(z.string(), z.unknown()),
});

/**
 * Validate template string syntax
 */
export interface TemplateStringValidationResult {
  isValid: boolean;
  errors: Array<{
    type:
      | "unclosed_bracket"
      | "invalid_variable"
      | "empty_variable"
      | "syntax_error";
    message: string;
    position?: number;
  }>;
  variables: string[];
}

export function validateTemplateString(
  template: string,
  availableVariables: TemplateVariable[] = []
): TemplateStringValidationResult {
  const result: TemplateStringValidationResult = {
    isValid: true,
    errors: [],
    variables: [],
  };

  // Extract all variable names from the template
  const variableMatches = template.match(/\{\{([^}]*)\}\}/g) || [];
  const availableVarNames = new Set(availableVariables.map((v) => v.name));

  // Check bracket balance
  const openBrackets = (template.match(/\{\{/g) || []).length;
  const closeBrackets = (template.match(/\}\}/g) || []).length;

  if (openBrackets !== closeBrackets) {
    result.isValid = false;
    if (openBrackets > closeBrackets) {
      result.errors.push({
        type: "unclosed_bracket",
        message: `${openBrackets - closeBrackets} unclosed template brackets`,
      });
    } else {
      result.errors.push({
        type: "unclosed_bracket",
        message: `${closeBrackets - openBrackets} extra closing brackets`,
      });
    }
  }

  // Validate each variable
  for (const match of variableMatches) {
    const fullVariable = match.slice(2, -2).trim();

    if (!fullVariable) {
      result.isValid = false;
      result.errors.push({
        type: "empty_variable",
        message: "Empty variable brackets found",
      });
      continue;
    }

    result.variables.push(fullVariable);

    // Check if variable exists in available variables
    if (availableVariables.length > 0 && !availableVarNames.has(fullVariable)) {
      result.isValid = false;
      result.errors.push({
        type: "invalid_variable",
        message: `Unknown variable: ${fullVariable}`,
      });
    }

    // Check for invalid variable syntax
    if (!/^[a-zA-Z][a-zA-Z0-9._]*$/.test(fullVariable)) {
      result.isValid = false;
      result.errors.push({
        type: "syntax_error",
        message: `Invalid variable syntax: ${fullVariable}`,
      });
    }
  }

  return result;
}

/**
 * Validate that slot names are unique
 */
export function validateSlotNameUniqueness(
  slotName: string,
  existingSlots: Record<string, SlotDraft>,
  currentSlotName?: string
): { isValid: boolean; error?: string } {
  // If we're editing an existing slot, allow the current name
  if (currentSlotName && slotName === currentSlotName) {
    return { isValid: true };
  }

  if (slotName in existingSlots) {
    return {
      isValid: false,
      error: `A slot named "${slotName}" already exists`,
    };
  }

  return { isValid: true };
}

/**
 * Validate that priority values are unique across slots
 */
export function validateSlotPriorityUniqueness(
  priority: number,
  existingSlots: Record<string, SlotDraft>,
  currentSlotName?: string
): { isValid: boolean; warning?: string } {
  const otherSlots = Object.entries(existingSlots).filter(
    ([name]) => name !== currentSlotName
  );

  const conflictingSlot = otherSlots.find(
    ([, slot]) => slot.priority === priority
  );

  if (conflictingSlot) {
    return {
      isValid: true, // This is a warning, not an error
      warning: `Priority ${priority} is already used by slot "${conflictingSlot[0]}"`,
    };
  }

  return { isValid: true };
}

/**
 * Validate that a slot is properly referenced in the layout
 */
export function validateSlotLayoutReference(
  slotName: string,
  layout: LayoutNodeDraft[]
): { isReferenced: boolean; warnings: string[] } {
  const warnings: string[] = [];

  const isReferenced = layout.some(
    (node) => node.kind === "slot" && node.name === slotName
  );

  if (!isReferenced) {
    warnings.push(
      `Slot "${slotName}" is not referenced in the template layout`
    );
  }

  return { isReferenced, warnings };
}

/**
 * Comprehensive validation for a slot draft
 */
export interface SlotValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: string[];
}

export function validateSlotDraft(
  slot: SlotDraft,
  parameters: RecipeParamSpec[],
  availableVariables: TemplateVariable[],
  existingSlots: Record<string, SlotDraft>,
  layout: LayoutNodeDraft[],
  currentSlotName?: string
): SlotValidationResult {
  const result: SlotValidationResult = {
    isValid: true,
    errors: {},
    warnings: [],
  };

  // Validate slot name
  try {
    slotNameSchema.parse(slot.name);
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.isValid = false;
      result.errors.name = error.issues[0]?.message || "Invalid slot name";
    }
  }

  // Check name uniqueness
  const nameUniqueness = validateSlotNameUniqueness(
    slot.name,
    existingSlots,
    currentSlotName
  );
  if (!nameUniqueness.isValid && nameUniqueness.error) {
    result.isValid = false;
    result.errors.name = nameUniqueness.error;
  }

  // Validate priority
  try {
    slotPrioritySchema.parse(slot.priority);
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.isValid = false;
      result.errors.priority = error.issues[0]?.message || "Invalid priority";
    }
  }

  // Check priority uniqueness (warning only)
  const priorityUniqueness = validateSlotPriorityUniqueness(
    slot.priority,
    existingSlots,
    currentSlotName
  );
  if (priorityUniqueness.warning) {
    result.warnings.push(priorityUniqueness.warning);
  }

  // Validate budget
  if (slot.budget !== undefined) {
    try {
      slotBudgetSchema.parse(slot.budget);
    } catch (error) {
      if (error instanceof z.ZodError) {
        result.isValid = false;
        result.errors.budget = error.issues[0]?.message || "Invalid budget";
      }
    }
  }

  // Validate parameters
  const parametersSchema = createRecipeParametersSchema(parameters);
  try {
    parametersSchema.parse(slot.params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      for (const zodError of error.issues) {
        const path = zodError.path[0];
        if (path) {
          result.isValid = false;
          result.errors[`param_${String(path)}`] = zodError.message;
        }
      }
    }
  }

  // Validate template strings in parameters
  for (const param of parameters) {
    if (param.type === "template_string") {
      const value = slot.params[param.key];
      if (typeof value === "string") {
        const templateValidation = validateTemplateString(
          value,
          availableVariables
        );
        if (!templateValidation.isValid) {
          result.isValid = false;
          result.errors[`param_${param.key}`] =
            templateValidation.errors[0]?.message || "Invalid template string";
        }
      }
    }
  }

  // Check layout reference
  const layoutReference = validateSlotLayoutReference(slot.name, layout);
  result.warnings.push(...layoutReference.warnings);

  return result;
}
