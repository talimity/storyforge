// Schemas and parsing

export { DefaultBudgetManager } from "./budget-manager";
export { compileTemplate } from "./compiler";
export { evaluateCondition } from "./condition-evaluator";
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
} from "./data-ref-resolver";
export {
  AuthoringValidationError,
  RenderError,
  TemplateStructureError,
} from "./errors";
export { assembleLayout } from "./layout-assembler";
export { compileLeaf } from "./leaf-compiler";
export type { ExecutionScope, PlanExecutionResult } from "./plan-executor";
export {
  createScope,
  executeForEachNode,
  executeIfNode,
  executeMessageNode,
  executePlanNode,
  executePlanNodes,
} from "./plan-executor";
export { render } from "./renderer";
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
} from "./schemas";
export type { SlotExecutionResult } from "./slot-executor";
export { executeSlots } from "./slot-executor";
export { extractAllSourceNames, lintSourceNames } from "./source-linter";
export { makeRegistry } from "./source-registry";

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
} from "./types";

export { validateTemplateStructure } from "./validator";

export { PROMPT_TEMPLATE_SPEC_VERSION } from "./version";
