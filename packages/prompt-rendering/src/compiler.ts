import { compileLeaf } from "./leaf-compiler.js";
import { RESERVED_SOURCES } from "./reserved-sources.js";
import { parseTemplate } from "./schemas.js";
import type {
  AttachmentLaneSpec,
  CompiledAttachmentLaneSpec,
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
  SourceSpec,
} from "./types.js";
import { validateTemplateStructure } from "./validator.js";

/**
 * Compiles a template, applying validation and preprocessing all leaf strings.
 * @param template - The template to compile (or JSON to parse)
 * @param options - Compilation options
 * @returns Immutable compiled template
 */
export function compileTemplate<K extends string, S extends SourceSpec>(
  template: PromptTemplate<K, S>,
  options?: CompileOptions
): CompiledTemplate<K, S>;
export function compileTemplate<K extends string, S extends SourceSpec>(
  template: unknown,
  options?: CompileOptions
): CompiledTemplate<K, S>;
export function compileTemplate<K extends string, S extends SourceSpec>(
  template: PromptTemplate<K, S> | unknown,
  options?: CompileOptions
): CompiledTemplate<K, S> {
  // 1: Parse with Zod and lint source references to try to
  // Merge reserved sources into allowed list so templates can reference them
  const allowed = options?.allowedSources
    ? [...options.allowedSources, ...RESERVED_SOURCES]
    : undefined;
  const parsedTemplate = parseTemplate<K, S>(template, options?.kind, allowed);

  // 2: Ensure consistent slot names and references
  validateTemplateStructure(parsedTemplate);

  // 4: Compile all leaf strings
  const compiled: CompiledTemplate<K, S> = {
    id: parsedTemplate.id,
    task: parsedTemplate.task,
    name: parsedTemplate.name,
    version: parsedTemplate.version,
    layout: compileLayoutNodes(parsedTemplate.layout),
    slots: compileSlots(parsedTemplate.slots),
    attachments: parsedTemplate.attachments
      ? compileAttachmentLanes(parsedTemplate.attachments)
      : undefined,
  };

  // 5: Deep freeze the result
  return deepFreeze(compiled);
}

/**
 * Compiles an array of layout nodes.
 */
function compileLayoutNodes<S extends SourceSpec = SourceSpec>(
  nodes: LayoutNode<S>[]
): readonly CompiledLayoutNode<S>[] {
  return Object.freeze(nodes.map(compileLayoutNode));
}

/**
 * Converts a MessageBlock or array of MessageBlocks to an immutable array of compiled message blocks.
 */
function toBlockArray<S extends SourceSpec = SourceSpec>(
  b: MessageBlock<S> | MessageBlock<S>[] | undefined
): readonly CompiledMessageBlock<S>[] | undefined {
  if (!b) return undefined;
  const arr = Array.isArray(b) ? b : [b];
  return Object.freeze(arr.map(compileMessageBlock));
}

/**
 * Compiles a single layout node.
 */
function compileLayoutNode<S extends SourceSpec = SourceSpec>(
  node: LayoutNode<S>
): CompiledLayoutNode<S> {
  const { kind } = node;
  switch (kind) {
    case "message":
      return Object.freeze({
        kind: "message",
        role: node.role,
        content: node.content ? compileLeaf(node.content) : undefined,
        from: node.from,
        when: node.when,
      });

    case "slot":
      return Object.freeze({
        kind: "slot",
        name: node.name,
        header: toBlockArray(node.header),
        footer: toBlockArray(node.footer),
        omitIfEmpty: node.omitIfEmpty,
      });
    case "anchor":
      return Object.freeze({
        kind: "anchor",
        key: compileLeaf(node.key),
        when: node.when,
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
function compileMessageBlock<S extends SourceSpec = SourceSpec>(
  block: MessageBlock<S>
): CompiledMessageBlock<S> {
  return Object.freeze({
    role: block.role,
    content: block.content ? compileLeaf(block.content) : undefined,
    from: block.from,
    when: block.when,
  });
}

/**
 * Compiles slot specifications.
 */
function compileSlots<S extends SourceSpec = SourceSpec>(
  slots: Record<string, SlotSpec<S>>
): Readonly<Record<string, CompiledSlotSpec<S>>> {
  const compiled: Record<string, CompiledSlotSpec<S>> = {};

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
function compilePlanNodes<S extends SourceSpec = SourceSpec>(
  nodes: PlanNode<S>[]
): readonly CompiledPlanNode<S>[] {
  return Object.freeze(nodes.map(compilePlanNode));
}

/**
 * Compiles a single plan node (recursively).
 */
function compilePlanNode<S extends SourceSpec = SourceSpec>(
  node: PlanNode<S>
): CompiledPlanNode<S> {
  const kind = node.kind;
  switch (kind) {
    case "message":
      return Object.freeze({
        kind: "message",
        role: node.role,
        content: node.content ? compileLeaf(node.content) : undefined,
        from: node.from,
        when: node.when,
        budget: node.budget,
      });

    case "forEach":
      return Object.freeze({
        kind: "forEach",
        source: node.source,
        order: node.order,
        limit: node.limit,
        fillDir: node.fillDir,
        map: compilePlanNodes(node.map),
        budget: node.budget,
      });

    case "if":
      return Object.freeze({
        kind: "if",
        when: node.when,
        then: compilePlanNodes(node.then),
        else: node.else ? compilePlanNodes(node.else) : undefined,
      });
    case "anchor":
      return Object.freeze({
        kind: "anchor",
        key: compileLeaf(node.key),
        when: node.when,
      });

    default: {
      const badKind = kind satisfies never;
      throw new Error(`Unknown plan node kind: ${badKind}`);
    }
  }
}

function compileAttachmentLanes(
  lanes: ReadonlyArray<AttachmentLaneSpec>
): readonly CompiledAttachmentLaneSpec[] {
  const compiled: CompiledAttachmentLaneSpec[] = [];
  for (const lane of lanes) {
    compiled.push(
      Object.freeze({
        id: lane.id,
        enabled: lane.enabled !== false,
        role: lane.role,
        template: lane.template ? compileLeaf(lane.template) : undefined,
        order: lane.order ?? 0,
        reserveTokens: lane.reserveTokens,
        budget: lane.budget,
        payload: lane.payload,
      })
    );
  }
  return Object.freeze(compiled);
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
