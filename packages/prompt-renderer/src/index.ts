// Schemas and parsing

export { compileTemplate } from "./compiler";

// Error types
export {
  AuthoringValidationError,
  RenderError,
  TemplateStructureError,
} from "./errors";
export { compileLeaf } from "./leaf-compiler";
export {
  budgetSchema,
  conditionRefSchema,
  dataRefSchema,
  layoutNodeSchema,
  messageBlockSchema,
  parseTemplate,
  planNodeSchema,
  promptTemplateSchema,
  responseTransformSchema,
  roleSchema,
  slotSpecSchema,
  taskKindSchema,
} from "./schemas";
export { extractAllSourceNames, lintSourceNames } from "./source-linter";
// Type exports
export type {
  Budget,
  BudgetManager,
  ChapterSummCtx,
  ChapterSummCtxDTO,
  CharacterCtxDTO,
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
  ResponseTransform,
  SlotSpec,
  SourceRegistry,
  TaskBoundTemplate,
  TaskCtx,
  TaskKind,
  TurnCtxDTO,
  TurnGenCtx,
  WritingAssistantCtx,
} from "./types";
// Validation and compilation
export { validateTemplateStructure } from "./validator";

// Future: export { render } from "./renderer";
