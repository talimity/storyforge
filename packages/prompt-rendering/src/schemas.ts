import { z } from "zod";
import { lintSourceNames } from "./source-linter.js";
import type {
  PromptTemplate,
  SourceSpec,
  UnboundConditionRef,
  UnboundLayoutNode,
  UnboundPlanNode,
  UnboundSlotSpec,
  UnboundTemplate,
} from "./types.js";

/** ---------- Core schemas ---------- */

export const roleSchema = z.enum(["system", "user", "assistant"]);

export const dataRefSchema = z.object({
  source: z.string(),
  args: z.unknown().optional(),
});

export const budgetSchema = z.object({
  maxTokens: z.number().int().positive().optional(),
});

/** ---------- Condition schemas ---------- */

export const conditionRefSchema: z.ZodType<UnboundConditionRef> =
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("exists"), ref: dataRefSchema }),
    z.object({ type: z.literal("nonEmpty"), ref: dataRefSchema }),
    z.object({
      type: z.enum(["eq", "neq", "gt", "lt"]),
      ref: dataRefSchema,
      value: z.unknown(),
    }),
  ]);

/** ---------- Message and layout schemas ---------- */

export const messageBlockSchema = z.object({
  role: roleSchema,
  content: z.string().optional(),
  from: dataRefSchema.optional(),
  prefix: z.boolean().optional(),
});

export const layoutNodeSchema: z.ZodType<UnboundLayoutNode> =
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("message"),
      name: z.string().optional(),
      role: roleSchema,
      content: z.string().optional(),
      from: dataRefSchema.optional(),
      prefix: z.boolean().optional(),
    }),
    z.object({
      kind: z.literal("slot"),
      name: z.string(),
      header: z
        .union([messageBlockSchema, z.array(messageBlockSchema)])
        .optional(),
      footer: z
        .union([messageBlockSchema, z.array(messageBlockSchema)])
        .optional(),
      omitIfEmpty: z.boolean().optional(),
    }),
  ]);

/** ---------- Plan node schemas (recursive) ---------- */

export const planNodeSchema: z.ZodType<UnboundPlanNode> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("message"),
      role: roleSchema,
      content: z.string().optional(),
      from: dataRefSchema.optional(),
      prefix: z.boolean().optional(),
      budget: budgetSchema.optional(),
    }),
    z.object({
      kind: z.literal("forEach"),
      source: dataRefSchema,
      order: z.enum(["asc", "desc"]).optional(),
      limit: z.number().int().positive().optional(),
      map: z.array(planNodeSchema),
      interleave: z
        .object({
          kind: z.literal("separator"),
          text: z.string().optional(),
        })
        .optional(),
      budget: budgetSchema.optional(),
      stopWhenOutOfBudget: z.boolean().optional(),
    }),
    z.object({
      kind: z.literal("if"),
      when: conditionRefSchema,
      then: z.array(planNodeSchema),
      else: z.array(planNodeSchema).optional(),
    }),
  ])
);

/** ---------- Slot specification schema ---------- */

export const slotSpecSchema: z.ZodType<UnboundSlotSpec> = z.object({
  priority: z.number().int().nonnegative(),
  when: conditionRefSchema.optional(),
  budget: budgetSchema.optional(),
  plan: z.array(planNodeSchema),
  meta: z.record(z.string(), z.unknown()).default({}),
});

/** ---------- Top-level template schema ---------- */

export const promptTemplateSchema = z.object({
  id: z.string(),
  task: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.literal(1),
  layout: z.array(layoutNodeSchema),
  slots: z.record(z.string(), slotSpecSchema),
}) satisfies z.ZodType<UnboundTemplate>;

/** ---------- Parse function ---------- */

/**
 * Parse and validate a template JSON object.
 * @param json - The JSON object to parse
 * @param kind - Optional task kind to assert the template's task against
 * @param allowedSources - Optional array of allowed source names to validate the template's datarefs against
 * @returns Parsed and validated PromptTemplate
 * @throws ZodError if validation fails
 */
export function parseTemplate<K extends string, S extends SourceSpec>(
  json: unknown,
  kind?: string,
  allowedSources?: ReadonlyArray<keyof S & string>
): PromptTemplate<K, S> {
  // This can technically be unsound but we trust the caller to bind K and S
  // correctly based on the context, and we only use this function at the
  // boundaries where we parse an untyped template retrieved from the database
  // or from a user import, in both cases with a known task kind and source spec
  // provided by the gentasks package.
  let schema = promptTemplateSchema;

  if (kind) {
    // Narrow the task kind if provided
    schema = schema.extend({
      task: z.string().refine((val) => val === kind, {
        message: `Task kind must be "${kind}"`,
      }),
    });
  }

  const tpl = schema.parse(json) as PromptTemplate<K, S>;

  if (allowedSources) {
    const allowed = new Set<keyof S & string>(allowedSources);
    lintSourceNames(tpl, allowed);
  }

  return tpl;
}
