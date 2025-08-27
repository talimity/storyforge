import { z } from "zod";
import type { PlanNode, PromptTemplate } from "./types";

/** ---------- Core schemas ---------- */

export const roleSchema = z.enum(["system", "user", "assistant"]);

export const dataRefSchema = z.object({
  source: z.string(),
  args: z.unknown().optional(),
});

export const budgetSchema = z.object({
  maxTokens: z.number().int().positive().optional(),
  softTokens: z.number().int().positive().optional(),
});

/** ---------- Condition schemas ---------- */

export const conditionRefSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("exists"),
    ref: dataRefSchema,
  }),
  z.object({
    type: z.literal("nonEmpty"),
    ref: dataRefSchema,
  }),
  z.object({
    type: z.enum(["eq", "neq", "gt", "lt"]),
    ref: dataRefSchema,
    value: z.unknown(),
  }),
]);

/** ---------- Transform schemas ---------- */

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

/** ---------- Message and layout schemas ---------- */

export const messageBlockSchema = z.object({
  role: roleSchema,
  content: z.string().optional(),
  from: dataRefSchema.optional(),
  prefix: z.boolean().optional(),
});

export const layoutNodeSchema = z.discriminatedUnion("kind", [
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

export const planNodeSchema: z.ZodType<PlanNode> = z.lazy(() =>
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

export const slotSpecSchema = z.object({
  priority: z.number().int().nonnegative(),
  when: conditionRefSchema.optional(),
  budget: budgetSchema.optional(),
  plan: z.array(planNodeSchema),
  meta: z.record(z.string(), z.unknown()).default({}),
});

/** ---------- Top-level template schema ---------- */

export const taskKindSchema = z.enum([
  "turn_generation",
  "chapter_summarization",
  "writing_assistant",
]);

export const promptTemplateSchema = z.object({
  id: z.string(),
  task: taskKindSchema,
  name: z.string(),
  version: z.literal(1),
  layout: z.array(layoutNodeSchema),
  slots: z.record(z.string(), slotSpecSchema),
  responseFormat: z
    .union([
      z.literal("text"),
      z.object({
        type: z.literal("json_schema"),
        schema: z.looseObject({}),
      }),
      z.literal("json"),
    ])
    .optional(),
  responseTransforms: z.array(responseTransformSchema).optional(),
});

type AssertEqual<T, U extends T> = T extends U ? true : never;
// @ts-ignore - suppress unused type error
type __PromptTemplateZodDriftCheck = AssertEqual<
  z.infer<typeof promptTemplateSchema>,
  PromptTemplate
>;

/** ---------- Parse function ---------- */

/**
 * Parse and validate a template JSON object.
 * @param json - The JSON object to parse
 * @returns Parsed and validated PromptTemplate
 * @throws ZodError if validation fails
 */
export function parseTemplate(json: unknown): PromptTemplate {
  return promptTemplateSchema.parse(json);
}
