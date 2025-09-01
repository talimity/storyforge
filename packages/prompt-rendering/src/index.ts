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
export { assembleLayout } from "./layout-assembler.js";
export { compileLeaf } from "./leaf-compiler.js";
export type { ExecutionScope, PlanExecutionResult } from "./plan-executor.js";
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

// Type exports
export type {
  Budget,
  BudgetManager,
  ChatCompletionMessage,
  ChatCompletionMessageRole,
  CompiledLayoutNode,
  CompiledLeafFunction,
  CompiledMessageBlock,
  CompiledPlanNode,
  CompiledSlotSpec,
  CompiledTemplate,
  CompileOptions,
  ConditionRef,
  DataRef,
  LayoutNode,
  MessageBlock,
  PlanNode,
  PromptTemplate,
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
