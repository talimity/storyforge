// Schemas and parsing

export { DefaultBudgetManager } from "./budget-manager.js";
export { compileTemplate } from "./compiler.js";
export { evaluateCondition } from "./condition-evaluator.js";
export {
  exists,
  isArray,
  isNonEmpty,
  isNonEmptyArray,
  isString,
  isValidNumber,
  resolveAsArray,
  resolveAsNumber,
  resolveAsString,
  resolveDataRef,
} from "./data-ref-resolver.js";
export {
  AuthoringValidationError,
  RenderError,
  TemplateStructureError,
} from "./errors.js";
export { assembleLayout, prepareLayout } from "./layout-assembler.js";
export { compileLeaf } from "./leaf-compiler.js";
export type { ExecutionScope, PlanExecutionBuffer } from "./plan-executor.js";
export {
  createScope,
  executeForEachNode,
  executeIfNode,
  executeMessageNode,
  executePlanNode,
  executePlanNodes,
} from "./plan-executor.js";
export { render } from "./renderer.js";
export {
  budgetSchema,
  conditionRefSchema,
  dataRefSchema,
  layoutNodeSchema,
  messageBlockSchema,
  parseTemplate,
  planNodeSchema,
  promptTemplateSchema,
  roleSchema,
  slotSpecSchema,
} from "./schemas.js";
export type { SlotExecutionResult } from "./slot-executor.js";
export { executeSlots } from "./slot-executor.js";
export { extractAllSourceNames, lintSourceNames } from "./source-linter.js";
export { makeRegistry } from "./source-registry.js";
export type { TemplateSegment, TemplateTokenizeResult } from "./template-tokenizer.js";
export { tokenizeTemplateString } from "./template-tokenizer.js";
// Type exports
export type {
  AttachmentLaneGroupRuntime,
  AttachmentLaneGroupSpec,
  AttachmentLaneRuntime,
  AttachmentLaneSpec,
  Budget,
  BudgetManager,
  ChatCompletionMessage,
  ChatCompletionMessageRole,
  CompiledAttachmentLaneGroupSpec,
  CompiledAttachmentLaneSpec,
  CompiledLayoutNode,
  CompiledLeafFunction,
  CompiledMessageBlock,
  CompiledPlanNode,
  CompiledSlotSpec,
  CompiledTemplate,
  CompileOptions,
  ConditionRef,
  DataRef,
  DataRefOf,
  GlobalAnchor,
  InjectionRequest,
  InjectionTarget,
  LayoutNode,
  MessageBlock,
  PlanNode,
  PromptTemplate,
  RenderOptions,
  SlotAnchor,
  SlotBuffer,
  SlotSpec,
  SourceHandler,
  SourceHandlerMap,
  SourceRegistry,
  SourceSpec,
  UnboundConditionRef,
  UnboundDataRef,
  UnboundLayoutNode,
  UnboundPlanNode,
  UnboundSlotSpec,
  UnboundSources,
  UnboundTemplate,
} from "./types.js";

export { validateTemplateStructure } from "./validator.js";

export { PROMPT_TEMPLATE_SPEC_VERSION } from "./version.js";

import jsonSchema from "./dsl-jsonschema.json" with { type: "json" };
export { jsonSchema };
