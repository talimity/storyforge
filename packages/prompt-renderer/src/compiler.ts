import { compileLeaf } from "./leaf-compiler";
import { parseTemplate } from "./schemas";
import { lintSourceNames } from "./source-linter";
import type {
  CompiledLayoutNode,
  CompiledMessageBlock,
  CompiledPlanNode,
  CompiledSlotSpec,
  CompiledTemplate,
  CompileOptions,
  LayoutNode,
  MessageBlock,
  PlanNode,
  PromptTemplate,
  SlotSpec,
  TaskBoundTemplate,
  TaskKind,
} from "./types";
import { validateTemplateStructure } from "./validator";

/**
 * Compiles a prompttemplate, applying validation and preprocessing all leaf strings.
 * @param template - The template to compile (or JSON to parse)
 * @param options - Compilation options
 * @returns Immutable compiled template
 */
export function compileTemplate<T extends TaskKind>(
  template: TaskBoundTemplate<T>,
  options?: CompileOptions
): CompiledTemplate<T>;
export function compileTemplate(
  template: PromptTemplate | unknown,
  options?: CompileOptions
): CompiledTemplate;
export function compileTemplate(
  template: PromptTemplate | unknown,
  options?: CompileOptions
): CompiledTemplate {
  // 1: Parse with Zod
  const parsedTemplate = parseTemplate(template);

  // 2: Ensure consistent slot names and references
  validateTemplateStructure(parsedTemplate);

  // 3: Lint source names if options provided
  if (options?.allowedSources) {
    lintSourceNames(parsedTemplate, new Set(options.allowedSources));
  }
  if (options?.taskKindSources) {
    const taskSources = options.taskKindSources[parsedTemplate.task];
    if (taskSources) {
      lintSourceNames(parsedTemplate, new Set(taskSources));
    }
  }

  // 4: Compile all leaf strings
  const compiled: CompiledTemplate = {
    id: parsedTemplate.id,
    task: parsedTemplate.task,
    name: parsedTemplate.name,
    version: parsedTemplate.version,
    layout: compileLayoutNodes(parsedTemplate.layout),
    slots: compileSlots(parsedTemplate.slots),
    responseFormat: parsedTemplate.responseFormat,
    responseTransforms: parsedTemplate.responseTransforms
      ? [...parsedTemplate.responseTransforms]
      : undefined,
  };

  // 5: Deep freeze the result
  return deepFreeze(compiled);
}

/**
 * Compiles an array of layout nodes.
 */
function compileLayoutNodes(
  nodes: LayoutNode[]
): readonly CompiledLayoutNode[] {
  return Object.freeze(nodes.map(compileLayoutNode));
}

/**
 * Converts a MessageBlock or array of MessageBlocks to an immutable array of compiled message blocks.
 */
function toBlockArray(
  b: MessageBlock | MessageBlock[] | undefined
): readonly CompiledMessageBlock[] | undefined {
  if (!b) return undefined;
  const arr = Array.isArray(b) ? b : [b];
  return Object.freeze(arr.map(compileMessageBlock));
}

/**
 * Compiles a single layout node.
 */
function compileLayoutNode(node: LayoutNode): CompiledLayoutNode {
  const { kind } = node;
  switch (kind) {
    case "message":
      return Object.freeze({
        kind: "message",
        role: node.role,
        content: node.content ? compileLeaf(node.content) : undefined,
        from: node.from,
        prefix: node.prefix,
      });

    case "slot":
      return Object.freeze({
        kind: "slot",
        name: node.name,
        header: toBlockArray(node.header),
        footer: toBlockArray(node.footer),
        omitIfEmpty: node.omitIfEmpty,
      });

    case "separator":
      return Object.freeze({
        kind: "separator",
        text: node.text ? compileLeaf(node.text) : undefined,
      });

    default: {
      const badKind = kind satisfies never;
      throw new Error(`Unknown layout node kind: ${badKind}`);
    }
  }
}

/**
 * Compiles a single message block.
 */
function compileMessageBlock<T extends MessageBlock>(
  block: T
): CompiledMessageBlock {
  return Object.freeze({
    role: block.role,
    content: block.content ? compileLeaf(block.content) : undefined,
    from: block.from,
    prefix: block.prefix,
  });
}

/**
 * Compiles slot specifications.
 */
function compileSlots(
  slots: Record<string, SlotSpec>
): Readonly<Record<string, CompiledSlotSpec>> {
  const compiled: Record<string, CompiledSlotSpec> = {};

  for (const [name, slot] of Object.entries(slots)) {
    compiled[name] = Object.freeze({
      priority: slot.priority,
      when: slot.when,
      budget: slot.budget,
      plan: compilePlanNodes(slot.plan),
    });
  }

  return Object.freeze(compiled);
}

/**
 * Compiles an array of plan nodes.
 */
function compilePlanNodes(nodes: PlanNode[]): readonly CompiledPlanNode[] {
  return Object.freeze(nodes.map(compilePlanNode));
}

/**
 * Compiles a single plan node (recursively).
 */
function compilePlanNode(node: PlanNode): CompiledPlanNode {
  const kind = node.kind;
  switch (kind) {
    case "message":
      return Object.freeze({
        kind: "message",
        role: node.role,
        content: node.content ? compileLeaf(node.content) : undefined,
        from: node.from,
        prefix: node.prefix,
        budget: node.budget,
      });

    case "forEach":
      return Object.freeze({
        kind: "forEach",
        source: node.source,
        order: node.order,
        limit: node.limit,
        map: compilePlanNodes(node.map),
        interleave: node.interleave
          ? Object.freeze({
              kind: "separator",
              text: node.interleave.text
                ? compileLeaf(node.interleave.text)
                : undefined,
            })
          : undefined,
        budget: node.budget,
        stopWhenOutOfBudget: node.stopWhenOutOfBudget,
      });

    case "if":
      return Object.freeze({
        kind: "if",
        when: node.when,
        then: compilePlanNodes(node.then),
        else: node.else ? compilePlanNodes(node.else) : undefined,
      });

    default: {
      const badKind = kind satisfies never;
      throw new Error(`Unknown plan node kind: ${badKind}`);
    }
  }
}

/**
 * Deep freezes an object and all its nested properties.
 */
function deepFreeze<T>(obj: T): T {
  // Freeze the object itself
  Object.freeze(obj);

  // Recursively freeze all properties
  if (obj && typeof obj === "object") {
    Object.values(obj).forEach((value) => {
      if (value && typeof value === "object") {
        deepFreeze(value);
      }
    });
  }

  return obj;
}
